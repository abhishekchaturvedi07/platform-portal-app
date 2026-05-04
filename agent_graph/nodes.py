from services.queue_producer import email_notification_node

# Add to your LangGraph workflow
workflow.add_node("NOTIFICATION", email_notification_node)