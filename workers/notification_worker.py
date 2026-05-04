import pika
import json

def callback(ch, method, properties, body):
    data = json.loads(body)
    print(f" [x] Sending email to User: {data['user_id']}")
    # LOGIC: Call SendGrid/SES/SMTP here
    print(f" [x] Email Sent: {data['content'][:30]}...")
    ch.basic_ack(delivery_tag=method.delivery_tag)

connection = pika.BlockingConnection(pika.ConnectionParameters('localhost'))
channel = connection.channel()
channel.queue_declare(queue='notification_queue', durable=True)

channel.basic_consume(queue='notification_queue', on_message_callback=callback)
print(' [*] Waiting for notification tasks. To exit press CTRL+C')
channel.start_consuming()