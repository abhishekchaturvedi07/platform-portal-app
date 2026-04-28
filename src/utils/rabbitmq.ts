import amqp from 'amqplib';

// Use the environment variable from Docker, fallback to localhost for standalone testing
const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';

export const publishEvent = async (queueName: string, payload: any) => {
  try {
    // 1. Connect to the RabbitMQ Broker
    const connection = await amqp.connect(RABBITMQ_URL);
    const channel = await connection.createChannel();

    // 2. Ensure the queue exists (durable: true means it survives a broker restart)
    await channel.assertQueue(queueName, { durable: true });

    // 3. Send the message to the queue
    const messageBuffer = Buffer.from(JSON.stringify(payload));
    channel.sendToQueue(queueName, messageBuffer, { 
      persistent: true // Ensures the message is saved to disk until processed
    });

    console.log(`✅ [Event Mesh] Published event to [${queueName}]:`, payload);

    // 4. Close the connection cleanly after a brief delay
    setTimeout(() => {
      connection.close();
    }, 500);

  } catch (error) {
    console.error('❌ [Event Mesh] Failed to publish event:', error);
  }
};