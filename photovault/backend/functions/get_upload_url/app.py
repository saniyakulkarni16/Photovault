import json
import os
import uuid

import boto3
from botocore.config import Config

REGION = os.environ["AWS_REGION"]
s3 = boto3.client(
    "s3",
    region_name=REGION,
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(signature_version="s3v4"),
)
BUCKET = os.environ["UPLOADS_BUCKET"]

ALLOWED_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def response(status, body):
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body),
    }


def handler(event, context):
    # userId comes from the verified Cognito JWT, never from the client
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]

    body = json.loads(event.get("body") or "{}")
    content_type = body.get("contentType", "")
    if content_type not in ALLOWED_TYPES:
        return response(400, {"error": f"contentType must be one of {list(ALLOWED_TYPES)}"})

    image_id = str(uuid.uuid4())
    key = f"uploads/{user_id}/{image_id}.{ALLOWED_TYPES[content_type]}"

    url = s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=300,
    )
    return response(200, {"uploadUrl": url, "imageId": image_id})
