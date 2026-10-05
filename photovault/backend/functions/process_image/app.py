import io
import os
import time
from urllib.parse import unquote_plus

import boto3
from PIL import Image, ImageOps

s3 = boto3.client("s3")
rekognition = boto3.client("rekognition")
table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])

PROCESSED_BUCKET = os.environ["PROCESSED_BUCKET"]
THUMB_SIZE = (256, 256)
RESIZED_MAX = (1024, 1024)


def save_variant(img, fmt, key, content_type):
    buf = io.BytesIO()
    img.save(buf, format=fmt, quality=85)
    buf.seek(0)
    s3.put_object(Bucket=PROCESSED_BUCKET, Key=key, Body=buf, ContentType=content_type)


def handler(event, context):
    for record in event["Records"]:
        bucket = record["s3"]["bucket"]["name"]
        key = unquote_plus(record["s3"]["object"]["key"])

        # key format: uploads/{userId}/{imageId}.{ext}
        _, user_id, filename = key.split("/", 2)
        image_id = filename.rsplit(".", 1)[0]

        obj = s3.get_object(Bucket=bucket, Key=key)
        original = Image.open(io.BytesIO(obj["Body"].read()))
        original = ImageOps.exif_transpose(original).convert("RGB")

        # Resized version (keeps aspect ratio)
        resized = original.copy()
        resized.thumbnail(RESIZED_MAX)
        resized_key = f"{user_id}/{image_id}/resized.jpg"
        save_variant(resized, "JPEG", resized_key, "image/jpeg")

        # Square-ish thumbnail
        thumb = original.copy()
        thumb.thumbnail(THUMB_SIZE)
        thumb_key = f"{user_id}/{image_id}/thumb.jpg"
        save_variant(thumb, "JPEG", thumb_key, "image/jpeg")

        # AI tagging
        labels = rekognition.detect_labels(
            Image={"S3Object": {"Bucket": bucket, "Name": key}},
            MaxLabels=10,
            MinConfidence=80,
        )["Labels"]
        tags = [l["Name"].lower() for l in labels]

        table.put_item(
            Item={
                "userId": user_id,
                "imageId": image_id,
                "thumbKey": thumb_key,
                "resizedKey": resized_key,
                "tags": tags,
                "width": original.width,
                "height": original.height,
                "createdAt": int(time.time()),
            }
        )
        print(f"Processed {key} -> tags={tags}")
