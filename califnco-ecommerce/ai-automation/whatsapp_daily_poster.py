"""Publish one Firestore product per day to WhatsApp Status through local WAHA."""

import os
import random
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"))

import instagram_daily_poster as instagram


WAHA_BASE_URL = os.getenv("WAHA_BASE_URL", "http://127.0.0.1:3008").rstrip("/")
WAHA_SESSION = os.getenv("WAHA_SESSION", "default").strip()
REQUEST_TIMEOUT = 45
RECENT_POST_DAYS = max(1, int(os.getenv("RECENT_POST_DAYS", "30")))


def post_whatsapp_status(image_url, caption):
    api_key = os.getenv("WAHA_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("WAHA_API_KEY is not configured in ai-automation/.env.")
    if not WAHA_SESSION:
        raise RuntimeError("WAHA_SESSION cannot be empty.")
    if not image_url:
        raise RuntimeError("A public Cloudinary image URL is required for WhatsApp Status.")

    endpoint = f"{WAHA_BASE_URL}/api/{quote(WAHA_SESSION, safe='')}/status/image"
    try:
        response = requests.post(
            endpoint,
            headers={"X-Api-Key": api_key},
            json={
                "file": {"mimetype": "image/jpeg", "url": image_url},
                "caption": caption,
            },
            timeout=REQUEST_TIMEOUT,
        )
    except requests.RequestException as error:
        raise RuntimeError(f"Could not reach WAHA at {WAHA_BASE_URL}: {error}") from error
    if not response.ok:
        raise RuntimeError(f"WAHA status publish failed (HTTP {response.status_code}).")
    try:
        result = response.json()
    except ValueError as error:
        raise RuntimeError("WAHA returned an invalid publish response.") from error
    if isinstance(result, dict) and result.get("error"):
        raise RuntimeError("WAHA rejected the status publish request.")
    return result


def local_date():
    return datetime.now().astimezone().date()


def recent_whatsapp_product_ids(documents):
    cutoff = datetime.now(timezone.utc) - timedelta(days=RECENT_POST_DAYS)
    recent_ids = set()
    for document in documents:
        post = document.to_dict() or {}
        if post.get("platform") != "whatsapp_status" or post.get("status") != "posted":
            continue
        posted_at = instagram.timestamp_datetime(post.get("postedAt"))
        if posted_at and posted_at >= cutoff and post.get("productId"):
            recent_ids.add(str(post["productId"]))
    return recent_ids


def status_caption(caption, hashtags):
    tags = " ".join(f"#{str(tag).lstrip('#')}" for tag in hashtags if str(tag).strip())
    return f"{caption.strip()}\n\n{tags}".strip()


def run_daily_workflow():
    database = instagram.firebase_services()
    post_id = f"whatsapp-daily-{local_date().isoformat()}"
    post_ref = database.collection("posts").document(post_id)
    previous = post_ref.get()
    prior_data = previous.to_dict() or {} if previous.exists else {}
    if prior_data.get("status") == "posted":
        print(f"WhatsApp Status already published for {local_date().isoformat()}; skipping.")
        return

    record = {
        "title": "WhatsApp daily product",
        "platform": "whatsapp_status",
        "source": "whatsapp_daily",
        "status": "scheduled",
        "active": False,
        "updatedAt": instagram.firestore.SERVER_TIMESTAMP,
        "createdAt": instagram.firestore.SERVER_TIMESTAMP,
    }
    product = None
    try:
        product_documents = list(database.collection("products").stream())
        products = [
            {**(item.to_dict() or {}), "id": item.id}
            for item in product_documents
            if (item.to_dict() or {}).get("name")
        ]
        if not products:
            raise RuntimeError("Firestore has no usable products in the products collection.")

        if prior_data.get("productId"):
            product = next(
                (item for item in products if item["id"] == str(prior_data["productId"])),
                None,
            )
        if product is None:
            post_documents = list(database.collection("posts").stream())
            recent_ids = recent_whatsapp_product_ids(post_documents)
            available = [item for item in products if item["id"] not in recent_ids]
            if not available:
                raise RuntimeError(
                    f"No product is eligible: every product was posted to WhatsApp in the last {RECENT_POST_DAYS} days."
                )
            product = random.choice(available)

        caption, hashtags, warnings = instagram.generate_caption(product)
        record.update(
            title=product.get("name", "Califnco product"),
            productId=product["id"],
            image=product.get("image") or product.get("imageUrl") or "",
            imageUrl=product.get("image") or product.get("imageUrl") or "",
            caption=caption,
            hashtags=hashtags,
            warnings=warnings,
            error=None,
        )
        post_ref.set(record, merge=True)

        image_bytes, image_warnings = instagram.get_image(product)
        warnings.extend(image_warnings)
        image_url = instagram.upload_image(image_bytes, post_id, folder="whatsapp")
        record.update(
            image=image_url,
            imageUrl=image_url,
            warnings=warnings,
            error=None,
            updatedAt=instagram.firestore.SERVER_TIMESTAMP,
        )
        post_ref.set(record, merge=True)

        result = post_whatsapp_status(image_url, status_caption(caption, hashtags))
        record.update(
            status="posted",
            active=False,
            postedAt=instagram.firestore.SERVER_TIMESTAMP,
            warnings=warnings,
            error=None,
            wahaMessageId=result.get("id") if isinstance(result, dict) else None,
            updatedAt=instagram.firestore.SERVER_TIMESTAMP,
        )
        post_ref.set(record, merge=True)
        print(f"Published WhatsApp Status for {product['name']} ({product['id']}).")
    except Exception as error:
        record.update(
            productId=product.get("id", "") if product else prior_data.get("productId", ""),
            status="failed",
            active=False,
            error=str(error),
            updatedAt=instagram.firestore.SERVER_TIMESTAMP,
        )
        post_ref.set(record, merge=True)
        raise


if __name__ == "__main__":
    run_daily_workflow()
