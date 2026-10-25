import io
import unittest
from unittest.mock import Mock, patch

from PIL import Image

import audit_product_images as audit
import instagram_daily_poster as instagram


def sample_image():
    stream = io.BytesIO()
    Image.new("RGB", (320, 240), "white").save(stream, format="PNG")
    return stream.getvalue()


class ProductImageAuditTests(unittest.TestCase):
    @patch.dict("os.environ", {"FIRESTORE_EMULATOR_HOST": "127.0.0.1:8080", "GCLOUD_PROJECT": "demo-califnco"})
    @patch.object(instagram.firestore, "client")
    @patch.object(instagram.firebase_admin, "initialize_app")
    @patch.object(instagram.firebase_admin, "_apps", {})
    def test_firebase_services_configures_emulator_without_service_account(self, initialize_app, client):
        application = object()
        database = object()
        initialize_app.return_value = application
        client.return_value = database

        result = instagram.firebase_services()

        self.assertIs(result, database)
        initialize_app.assert_called_once()
        self.assertEqual(
            initialize_app.call_args.kwargs["options"],
            {"projectId": "demo-califnco"},
        )
        self.assertIsInstance(
            initialize_app.call_args.kwargs["credential"].get_credential(),
            instagram.AnonymousCredentials,
        )
        client.assert_called_once_with(application)

    def test_vision_image_converts_to_jpeg(self):
        result = audit.vision_image(sample_image())
        with Image.open(io.BytesIO(result)) as image:
            self.assertEqual(image.format, "JPEG")
            self.assertLessEqual(max(image.size), 768)

    @patch.dict("os.environ", {"GEMINI_API_KEY": "test-key"})
    @patch.object(audit.requests, "post")
    def test_image_match_result_parses_visual_response(self, post):
        response = Mock(ok=True)
        response.json.return_value = {
            "candidates": [{
                "content": {"parts": [{"text": '{"matches": true, "reason": "A water purifier is visible."}'}]}
            }]
        }
        post.return_value = response

        matches, reason = audit.image_match_result(
            {"name": "Water purifier", "description": "Countertop purifier"},
            sample_image(),
        )

        self.assertTrue(matches)
        self.assertEqual(reason, "A water purifier is visible.")
        self.assertEqual(post.call_args.kwargs["json"]["contents"][0]["parts"][1]["inline_data"]["mime_type"], "image/jpeg")

    @patch.object(audit, "image_match_result", return_value=(False, "The image shows a landscape."))
    @patch.object(audit, "download_image", return_value=b"existing")
    def test_dry_run_does_not_update_firestore(self, download, match):
        snapshot = Mock()
        snapshot.id = "product-1"
        snapshot.to_dict.return_value = {
            "name": "Water purifier",
            "description": "Countertop purifier",
            "image": "https://images.example/current.jpg",
        }
        snapshot.reference = Mock()

        result = audit.audit_product(snapshot, apply_changes=False)

        self.assertEqual(result["status"], "mismatch")
        snapshot.reference.update.assert_not_called()

    @patch.object(audit, "download_image", side_effect=RuntimeError("HTTP 404"))
    def test_unavailable_image_is_reported_as_mismatch(self, download):
        snapshot = Mock()
        snapshot.id = "product-404"
        snapshot.to_dict.return_value = {
            "name": "Water purifier",
            "description": "Countertop purifier",
            "image": "https://images.example/missing.jpg",
        }
        snapshot.reference = Mock()

        result = audit.audit_product(snapshot, apply_changes=False)

        self.assertEqual(result["status"], "mismatch")
        self.assertIn("unavailable", result["reason"])
        snapshot.reference.update.assert_not_called()

    @patch.object(audit, "upload_image", return_value="https://res.cloudinary.com/demo/image/upload/replacement.jpg")
    @patch.object(audit, "generate_product_image", return_value=b"generated")
    @patch.object(audit, "image_match_result", side_effect=[
        (False, "Existing image does not show the product."),
        (True, "Generated image shows the described purifier."),
    ])
    @patch.object(audit, "download_image", return_value=b"existing")
    @patch.object(audit, "CLOUDINARY_CLOUD_NAME", "demo-cloud")
    @patch.object(audit, "CLOUDINARY_UPLOAD_PRESET", "test-preset")
    def test_apply_updates_firestore_only_after_generated_image_passes_review(
        self, download, match, generate, upload
    ):
        snapshot = Mock()
        snapshot.id = "product-2"
        snapshot.to_dict.return_value = {
            "name": "Water purifier",
            "description": "Countertop purifier",
            "image": "https://images.example/current.jpg",
        }
        snapshot.reference = Mock()

        result = audit.audit_product(snapshot, apply_changes=True)

        self.assertEqual(result["status"], "replaced")
        snapshot.reference.update.assert_called_once()
        fields = snapshot.reference.update.call_args.args[0]
        self.assertEqual(fields["image"], result["replacementImageUrl"])
        self.assertEqual(fields["imageAudit"]["status"], "replaced")


if __name__ == "__main__":
    unittest.main()
