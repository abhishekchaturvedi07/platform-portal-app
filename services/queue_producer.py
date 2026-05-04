import pika
import json
import os
from dotenv import load_dotenv

load_dotenv()

def publish_to_notification_queue(user_id, content):
    # Retrieve config from .env
    host = os.getenv('RABBITMQ_HOST', 'localhost')
    queue_name = os.getenv('NOTIFICATION_QUEUE_NAME', 'ai_notification_tasks')
    
    # Establish Connection
    connection = pika.BlockingConnection(pika.ConnectionParameters(host=host))
    channel = connection.channel()
    
    # Ensure queue exists and is durable (survives RabbitMQ restart)
    channel.queue_declare(queue=queue_name, durable=True)

    payload = {
        "user_id": user_id,
        "message": content,
        "type": "EMAIL_SUMMARY"
    }

    channel.basic_publish(
        exchange='',
        routing_key=queue_name,
        body=json.dumps(payload),
        properties=pika.BasicProperties(delivery_mode=2) # Persistent message
    )
    
    connection.close()
    print(f" [✔] Task for {user_id} published to {queue_name}")