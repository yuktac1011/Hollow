from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any

app = FastAPI()

# Enable CORS for the frontend's domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For production, replace "*" with your Vercel domain e.g., ["https://hollow-demo.vercel.app"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class MessageData(BaseModel):
    message: str
    conversation_history: List[Dict[str, Any]]

@app.post("/score-message")
async def score_message(data: MessageData):
    urgency_words = ["emergency", "right now", "immediately", "urgent", "hospital", "dying", "quick", "hurry", "now"]
    refusal_words = ["can't verify", "don't have access to", "skip the check", "don't have", "cannot", "can't", "refuse", "why do you need", "just let me in", "no phone"]
    authority_words = ["i demand", "escalate this", "your manager", "supervisor", "fired", "lose your job", "responsible", "sue", "lawyer"]
    
    score = 0
    signals_detected = []
    
    # Process all customer messages in the conversation (history + current)
    customer_messages = [
        msg.get("text", "") 
        for msg in data.conversation_history 
        if msg.get("sender") == "customer"
    ]
    customer_messages.append(data.message)
    
    for text in customer_messages:
        text_lower = text.lower()
        
        # Check urgency (+15)
        if any(w in text_lower for w in urgency_words):
            score += 15
            if "Urgency escalation detected" not in signals_detected:
                signals_detected.append("Urgency escalation detected")
                
        # Check refusal (+25)
        if any(w in text_lower for w in refusal_words):
            score += 25
            if "Verification refusal detected" not in signals_detected:
                signals_detected.append("Verification refusal detected")
                
        # Check authority (+20)
        if any(w in text_lower for w in authority_words):
            score += 20
            if "Authority pressure detected" not in signals_detected:
                signals_detected.append("Authority pressure detected")
                
    final_score = min(score, 100)
    
    if final_score >= 75:
        action = "block"
    elif final_score >= 40:
        action = "nudge"
    else:
        action = "allow"
        
    return {
        "risk_score": final_score,
        "signals_detected": signals_detected,
        "action": action
    }
