"""Audit and optionally replace Firestore product images using Gemini and Cloudinary."""

import argparse
import base64
import json
import os
import sys
import time
from datetime import datetime, timezone
from io import BytesIO

import requests
from PIL import Image, ImageOps
from dotenv import load_dotenv

from instagram_daily_poster import (
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_UPLOAD_PRESET,
    GEMINI_MODEL,
    REQUEST_TIMEOUT,
    download_image,
    firebase_services,
    generate_product_image,
    upload_image,
    firestore,
)


load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env"), override=True)


def audit_firestore():
    return firebase_services()


def vision_image(image_bytes):
    try:
        with Image.open(BytesIO(image_bytes)) as source:
            source.load()
            image = ImageOps.contain(source.convert("RGB"), (768, 768), method=Image.Resampling.LANCZOS)
            output = BytesIO()
            image.save(output, format="JPEG", quality=82, optimize=True)
            return output.getvalue()
    except (OSError, ValueError) as error:
        raise RuntimeError("Image could not be decoded for visual review.") from error


def image_match_result(product, image_bytes):
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required to audit image relevance.")
    product_details = (
        f"Product name: {product.get('name', '')}\n"
        f"Description: {product.get('description', '')}\n"
        f"Category: {product.get('category', '')}"
    )
    prompt = (
        "Compare the image to the provided product record. Decide whether the image visibly "
        "represents the named product/category well enough to use on its product listing. "
        "A generic water, kitchen, person, or unrelated-equipment photo is not a match. "
        "Do not infer that unseen features are present. Return only JSON with boolean `matches` "
        "and a brief `reason` string.\n\n"
        + product_details
    )
    response = requests.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{GEMINI_MODEL}:generateContent",
        headers={"x-goog-api-key": api_key},
        json={
            "contents": [{
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": "image/jpeg",
                            "data": base64.b64encode(vision_image(image_bytes)).decode("ascii"),
                        }
                    },
                ]
            }],
            "generationConfig": {"responseMimeType": "application/json"},
        },
        timeout=REQUEST_TIMEOUT,
    )
    if not response.ok:
        raise RuntimeError(f"Gemini image audit failed (HTTP {response.status_code}).")
    try:
        text = response.json()["candidates"][0]["content"]["parts"][0]["text"]
        result = json.loads(text)
        matches = result["matches"]
        reason = result["reason"]
        if not isinstance(matches, bool) or not isinstance(reason, str) or not reason.strip():
            raise ValueError("Gemini response has incorrect fields.")
        return matches, reason.strip()
    except (KeyError, IndexError, TypeError, ValueError) as error:
        raise RuntimeError("Gemini returned an invalid image-audit response.") from error


def audit_product(document, apply_changes):
    product = {**(document.to_dict() or {}), "id": document.id}
    name = str(product.get("name") or "").strip()
    if not name:
        raise RuntimeError("Product has no name.")

    image_url = product.get("image") or product.get("imageUrl")
    if not image_url:
        matched, reason = False, "No product image URL is set."
    else:
        try:
            image_bytes = download_image(image_url)
        except (requests.RequestException, RuntimeError) as error:
            matched, reason = False, f"Current image URL is unavailable: {error}"
        else:
            matched, reason = image_match_result(product, image_bytes)

    report = {
        "productId": document.id,
        "name": name,
        "currentImageUrl": image_url or "",
        "matches": matched,
        "reason": reason,
        "replacementImageUrl": None,
        "status": "matched" if matched else "mismatch",
    }
    if not apply_changes:
        return report

    if matched:
        document.reference.update({
            "imageAudit": {
                "status": "matched",
                "reason": reason,
                "auditedAt": firestore.SERVER_TIMESTAMP,
                "auditedBy": "gemini-visual-audit",
            },
            "updatedAt": firestore.SERVER_TIMESTAMP,
        })
        return report

    if not CLOUDINARY_CLOUD_NAME or not CLOUDINARY_UPLOAD_PRESET:
        raise RuntimeError("Cloudinary cloud name and unsigned image upload preset are required to replace images.")

    generated_image = generate_product_image(product)
    replacement_matches, replacement_reason = image_match_result(product, generated_image)
    if not replacement_matches:
        raise RuntimeError(f"Generated image did not pass visual review: {replacement_reason}")

    replacement_url = upload_image(generated_image, f"product-audit-{document.id}")
    report["replacementImageUrl"] = replacement_url
    report["status"] = "replaced"
    report["replacementReason"] = replacement_reason
    document.reference.update({
        "image": replacement_url,
        "imageUrl": replacement_url,
        "imageAudit": {
            "status": "replaced",
            "reason": reason,
            "replacementReason": replacement_reason,
            "auditedAt": firestore.SERVER_TIMESTAMP,
            "auditedBy": "gemini-visual-audit",
        },
        "updatedAt": firestore.SERVER_TIMESTAMP,
    })
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Upload a visually verified replacement and update mismatched Firestore products.",
    )
    parser.add_argument(
        "--delay-seconds",
        type=float,
        default=6,
        help="Pause between products to respect free-tier image-audit quotas (default: 6).",
    )
    args = parser.parse_args()
    if args.delay_seconds < 0:
        parser.error("--delay-seconds must be non-negative.")

    database = audit_firestore()
    documents = list(database.collection("products").stream())
    if not documents:
        print("Firestore products collection is empty.", file=sys.stderr)
        return 1

    reports = []
    errors = 0
    for index, document in enumerate(documents):
        try:
            report = audit_product(document, args.apply)
        except (requests.RequestException, RuntimeError, ValueError) as error:
            errors += 1
            report = {
                "productId": document.id,
                "name": str((document.to_dict() or {}).get("name") or ""),
                "status": "error",
                "error": str(error),
            }
        reports.append(report)
        print(json.dumps(report, ensure_ascii=False))
        if index < len(documents) - 1 and args.delay_seconds:
            time.sleep(args.delay_seconds)

    summary = {
        "productsAudited": len(reports),
        "matched": sum(item["status"] == "matched" for item in reports),
        "mismatched": sum(item["status"] == "mismatch" for item in reports),
        "replaced": sum(item["status"] == "replaced" for item in reports),
        "errors": errors,
        "applyChanges": args.apply,
        "completedAt": datetime.now(timezone.utc).isoformat(),
    }
    print(json.dumps({"summary": summary}, ensure_ascii=False))
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
