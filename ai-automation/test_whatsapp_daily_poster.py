import unittest
from datetime import date, datetime, timezone
from unittest.mock import Mock, patch

import requests

import whatsapp_daily_poster as whatsapp


class FakeSnapshot:
    def __init__(self, document_id, data=None):
        self.id = document_id
        self._data = data
        self.exists = data is not None

    def to_dict(self):
        return self._data


class FakeDocumentReference:
    def __init__(self, collection, document_id):
        self.collection = collection
        self.id = document_id

    def get(self):
        data = self.collection.documents.get(self.id)
        return FakeSnapshot(self.id, data)

    def set(self, fields, merge=False):
        existing = self.collection.documents.get(self.id, {}) if merge else {}
        self.collection.documents[self.id] = {**existing, **fields}


class FakeCollection:
    def __init__(self, documents=None):
        self.documents = documents or {}

    def document(self, document_id):
        return FakeDocumentReference(self, document_id)

    def stream(self):
        return [FakeSnapshot(document_id, data) for document_id, data in self.documents.items()]


class FakeDatabase:
    def __init__(self):
        self.collections = {
            "products": FakeCollection({
                "product-1": {
                    "name": "Countertop purifier",
                    "description": "Compact water purifier",
                    "retailPrice": 12000,
                    "image": "https://example.test/product.jpg",
                }
            }),
            "posts": FakeCollection(),
        }

    def collection(self, name):
        return self.collections[name]


class WhatsAppDailyPosterTests(unittest.TestCase):
    @patch.dict("os.environ", {"WAHA_API_KEY": "local-test-key"})
    @patch.object(whatsapp.requests, "post")
    def test_posts_public_image_using_authenticated_waha_status_endpoint(self, post):
        response = Mock(ok=True)
        response.json.return_value = {"id": "status-message-1"}
        post.return_value = response
        with patch.object(whatsapp, "WAHA_BASE_URL", "http://127.0.0.1:3008"), patch.object(
            whatsapp, "WAHA_SESSION", "secondary"
        ):
            result = whatsapp.post_whatsapp_status(
                "https://res.cloudinary.com/demo/image/upload/product.jpg",
                "Today's product #Califnco",
            )

        self.assertEqual(result["id"], "status-message-1")
        self.assertEqual(
            post.call_args.args[0],
            "http://127.0.0.1:3008/api/secondary/status/image",
        )
        self.assertEqual(post.call_args.kwargs["headers"]["X-Api-Key"], "local-test-key")
        self.assertEqual(
            post.call_args.kwargs["json"],
            {
                "file": {
                    "mimetype": "image/jpeg",
                    "url": "https://res.cloudinary.com/demo/image/upload/product.jpg",
                },
                "caption": "Today's product #Califnco",
            },
        )

    @patch.dict("os.environ", {}, clear=True)
    def test_missing_api_key_is_an_explicit_failure(self):
        with self.assertRaisesRegex(RuntimeError, "WAHA_API_KEY"):
            whatsapp.post_whatsapp_status("https://example.test/image.jpg", "Caption")

    @patch.dict("os.environ", {"WAHA_API_KEY": "local-test-key"})
    @patch.object(whatsapp.requests, "post")
    def test_waha_http_error_is_not_reported_as_success(self, post):
        post.return_value.ok = False
        post.return_value.status_code = 401
        with self.assertRaisesRegex(RuntimeError, "HTTP 401"):
            whatsapp.post_whatsapp_status("https://example.test/image.jpg", "Caption")

    @patch.dict("os.environ", {"WAHA_API_KEY": "local-test-key"})
    @patch.object(whatsapp.requests, "post", side_effect=requests.ConnectionError("connection refused"))
    def test_unreachable_waha_is_not_reported_as_success(self, post):
        with patch.object(whatsapp, "WAHA_BASE_URL", "http://127.0.0.1:3008"):
            with self.assertRaisesRegex(RuntimeError, "Could not reach WAHA"):
                whatsapp.post_whatsapp_status("https://example.test/image.jpg", "Caption")

    def test_caption_includes_product_hashtags(self):
        result = whatsapp.status_caption("Today's purifier", ["Califnco", "#PureWater"])
        self.assertEqual(result, "Today's purifier\n\n#Califnco #PureWater")

    def test_recent_product_rotation_only_counts_whatsapp_posts(self):
        recent = Mock()
        recent.to_dict.return_value = {
            "platform": "whatsapp_status",
            "status": "posted",
            "productId": "already-used",
            "postedAt": datetime.now(timezone.utc),
        }
        instagram_post = Mock()
        instagram_post.to_dict.return_value = {
            "platform": "instagram",
            "status": "posted",
            "productId": "instagram-only",
            "postedAt": datetime.now(timezone.utc),
        }

        self.assertEqual(
            whatsapp.recent_whatsapp_product_ids([recent, instagram_post]),
            {"already-used"},
        )

    @patch.object(whatsapp, "post_whatsapp_status", return_value={"id": "status-1"})
    @patch.object(whatsapp.instagram, "upload_image", return_value="https://cloudinary.test/product.jpg")
    @patch.object(whatsapp.instagram, "get_image", return_value=(b"jpeg", []))
    @patch.object(whatsapp.instagram, "generate_caption", return_value=("Product caption", ["Califnco"], []))
    @patch.object(whatsapp.instagram, "firebase_services")
    def test_daily_workflow_records_successful_waha_publish(
        self, firebase_services, caption, get_image, upload_image, publish
    ):
        database = FakeDatabase()
        firebase_services.return_value = database
        with patch.object(whatsapp, "local_date", return_value=date(2026, 10, 25)):
            whatsapp.run_daily_workflow()

        record = database.collections["posts"].documents["whatsapp-daily-2026-10-25"]
        self.assertEqual(record["status"], "posted")
        self.assertEqual(record["platform"], "whatsapp_status")
        self.assertEqual(record["productId"], "product-1")
        self.assertEqual(record["imageUrl"], "https://cloudinary.test/product.jpg")
        self.assertEqual(record["wahaMessageId"], "status-1")
        publish.assert_called_once_with(
            "https://cloudinary.test/product.jpg",
            "Product caption\n\n#Califnco",
        )

    @patch.object(whatsapp, "post_whatsapp_status")
    @patch.object(whatsapp.instagram, "firebase_services")
    def test_daily_workflow_skips_a_product_already_posted_today(self, firebase_services, publish):
        database = FakeDatabase()
        database.collections["posts"].documents["whatsapp-daily-2026-10-25"] = {
            "status": "posted",
            "platform": "whatsapp_status",
        }
        firebase_services.return_value = database
        with patch.object(whatsapp, "local_date", return_value=date(2026, 10, 25)):
            whatsapp.run_daily_workflow()

        publish.assert_not_called()

    @patch.object(whatsapp, "post_whatsapp_status", side_effect=RuntimeError("WAHA unavailable"))
    @patch.object(whatsapp.instagram, "upload_image", return_value="https://cloudinary.test/product.jpg")
    @patch.object(whatsapp.instagram, "get_image", return_value=(b"jpeg", []))
    @patch.object(whatsapp.instagram, "generate_caption", return_value=("Product caption", ["Califnco"], []))
    @patch.object(whatsapp.instagram, "firebase_services")
    def test_daily_workflow_records_failure_without_claiming_success(
        self, firebase_services, caption, get_image, upload_image, publish
    ):
        database = FakeDatabase()
        firebase_services.return_value = database
        with patch.object(whatsapp, "local_date", return_value=date(2026, 10, 25)):
            with self.assertRaisesRegex(RuntimeError, "WAHA unavailable"):
                whatsapp.run_daily_workflow()

        record = database.collections["posts"].documents["whatsapp-daily-2026-10-25"]
        self.assertEqual(record["status"], "failed")
        self.assertEqual(record["error"], "WAHA unavailable")


if __name__ == "__main__":
    unittest.main()
