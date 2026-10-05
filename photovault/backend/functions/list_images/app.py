import json
import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.config import Config

REGION = os.environ["AWS_REGION"]
s3 = boto3.client(
    "s3",
    region_name=REGION,
    endpoint_url=f"https://s3.{REGION}.amazonaws.com",
    config=Config(signature_version="s3v4"),
)
table = boto3.resource("dynamodb").Table(os.environ["TABLE_NAME"])
PROCESSED_BUCKET = os.environ["PROCESSED_BUCKET"]


def presign(key):
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": PROCESSED_BUCKET, "Key": key},
        ExpiresIn=3600,
    )


def handler(event, context):
    user_id = event["requestContext"]["authorizer"]["jwt"]["claims"]["sub"]
    tag = (event.get("queryStringParameters") or {}).get("tag", "").strip().lower()

    kwargs = {"KeyConditionExpression": Key("userId").eq(user_id)}
    if tag:
        kwargs["FilterExpression"] = Attr("tags").contains(tag)

    items = []
    while True:
        result = table.query(**kwargs)
        items.extend(result["Items"])
        if "LastEvaluatedKey" not in result:
            break
        kwargs["ExclusiveStartKey"] = result["LastEvaluatedKey"]

    images = [
        {
            "imageId": i["imageId"],
            "tags": i.get("tags", []),
            "createdAt": int(i["createdAt"]),
            "thumbUrl": presign(i["thumbKey"]),
            "imageUrl": presign(i["resizedKey"]),
        }
        for i in sorted(items, key=lambda x: x["createdAt"], reverse=True)
    ]

    return {
        "statusCode": 200,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"images": images}),
    }
