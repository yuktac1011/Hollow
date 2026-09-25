import json
import asyncio
from datetime import datetime
from typing import List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import redis.asyncio as aioredis

from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy import Column, String, Integer, DateTime, JSON, ForeignKey

import os

# =======================
# CONFIGURATION
# =======================
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost/hollow")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

engine = create_async_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
Base = declarative_base()

# =======================
# DATABASE MODELS
# =======================
class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(String, primary_key=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default="active")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    sender = Column(String)
    text = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class RiskEvent(Base):
    __tablename__ = "risk_events"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String, ForeignKey("conversations.id"))
    message_id = Column(Integer, ForeignKey("messages.id"))
    risk_score = Column(Integer)
    signals = Column(JSON)
    action = Column(String)
    reasoning = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow)

# =======================
# APP INITIALIZATION
# =======================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

redis_client = aioredis.from_url(REDIS_URL, decode_responses=True)

class ConnectionManager:
    def __init__(self):
        self.active_connections: dict[str, List[WebSocket]] = {}

    async def connect(self, websocket: WebSocket, conversation_id: str):
        await websocket.accept()
        if conversation_id not in self.active_connections:
            self.active_connections[conversation_id] = []
        self.active_connections[conversation_id].append(websocket)

    def disconnect(self, websocket: WebSocket, conversation_id: str):
        if conversation_id in self.active_connections:
            self.active_connections[conversation_id].remove(websocket)
            if not self.active_connections[conversation_id]:
                del self.active_connections[conversation_id]

    async def broadcast(self, conversation_id: str, message: dict):
        if conversation_id in self.active_connections:
            for connection in self.active_connections[conversation_id]:
                await connection.send_json(message)

manager = ConnectionManager()

# =======================
# SCHEMAS
# =======================
class MessageInput(BaseModel):
    conversation_id: str
    message: str
    sender: str

# =======================
# ENDPOINTS
# =======================

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: str):
    await manager.connect(websocket, conversation_id)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)

@app.post("/score-message")
async def score_message(data: MessageInput):
    async with SessionLocal() as db:
        # 1. Ensure conversation exists
        conv = await db.get(Conversation, data.conversation_id)
        if not conv:
            conv = Conversation(id=data.conversation_id)
            db.add(conv)
            await db.commit()

        # 2. Save Message
        msg = Message(conversation_id=data.conversation_id, sender=data.sender, text=data.message)
        db.add(msg)
        await db.commit()
        await db.refresh(msg)

        if data.sender != "customer":
            return {"status": "recorded"}

        # 3. Analyze Message
        urgency_words = ["emergency", "right now", "immediately", "urgent", "hospital", "dying", "quick", "hurry"]
        refusal_words = ["can't verify", "don't have access to", "skip the check", "don't have", "cannot", "can't", "refuse", "why do you need", "just let me in", "no phone"]
        authority_words = ["i demand", "escalate this", "your manager", "supervisor", "fired", "lose your job", "responsible", "sue", "lawyer"]
        emotional_words = ["desperate", "please help", "crying", "life depends", "ruined"]

        text_lower = data.message.lower()
        score_bump = 0
        signals_detected = []

        if any(w in text_lower for w in urgency_words):
            score_bump += 15
            signals_detected.append("Urgency escalation detected")
        if any(w in text_lower for w in refusal_words):
            score_bump += 25
            signals_detected.append("Verification refusal detected")
        if any(w in text_lower for w in authority_words):
            score_bump += 20
            signals_detected.append("Authority pressure detected")
        if any(w in text_lower for w in emotional_words):
            score_bump += 15
            signals_detected.append("Emotional pressure detected")

        # 4. State Management (Redis)
        score_key = f"risk_score:{data.conversation_id}"
        signals_key = f"risk_signals:{data.conversation_id}"
        
        current_score = int(await redis_client.get(score_key) or 0)
        
        if score_bump > 0:
            new_score = min(current_score + score_bump, 100)
            await redis_client.setex(score_key, 3600, new_score)
            
            # Store unique signals
            existing_signals = await redis_client.smembers(signals_key)
            for s in signals_detected:
                if s not in existing_signals:
                    await redis_client.sadd(signals_key, s)
            await redis_client.expire(signals_key, 3600)
        else:
            # Decay score if no new signals
            new_score = max(current_score - 5, 0)
            await redis_client.setex(score_key, 3600, new_score)

        all_signals = list(await redis_client.smembers(signals_key))

        # 5. Determine Action
        action = "allow"
        reasoning = None
        if new_score >= 75:
            action = "block"
            reasoning = f"Blocked due to high risk indicators: {', '.join(all_signals)}"
        elif new_score >= 40:
            action = "nudge"

        # 6. Log Risk Event if notable
        if new_score >= 40:
            risk_event = RiskEvent(
                conversation_id=data.conversation_id,
                message_id=msg.id,
                risk_score=new_score,
                signals=all_signals,
                action=action,
                reasoning=reasoning
            )
            db.add(risk_event)
            await db.commit()

        response_payload = {
            "risk_score": new_score,
            "signals_detected": all_signals,
            "action": action,
            "reasoning": reasoning
        }

        # 7. Broadcast via WebSockets
        await manager.broadcast(data.conversation_id, response_payload)

        return response_payload

from sqlalchemy import select

@app.get("/conversation/{conversation_id}/history")
async def get_history(conversation_id: str):
    async with SessionLocal() as db:
        # Get messages
        stmt = select(Message).where(Message.conversation_id == conversation_id).order_by(Message.timestamp)
        result = await db.execute(stmt)
        messages = result.scalars().all()
        
        # Get risk events
        stmt_risk = select(RiskEvent).where(RiskEvent.conversation_id == conversation_id).order_by(RiskEvent.timestamp)
        result_risk = await db.execute(stmt_risk)
        risk_events = result_risk.scalars().all()
        
        return {
            "messages": [{"sender": m.sender, "text": m.text, "timestamp": m.timestamp} for m in messages],
            "risk_events": [
                {
                    "score": r.risk_score, 
                    "signals": r.signals, 
                    "action": r.action, 
                    "reasoning": r.reasoning,
                    "timestamp": r.timestamp
                } for r in risk_events
            ]
        }
