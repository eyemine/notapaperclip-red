import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, clipId, timestamp, groundCount } = body;
    
    // GlassBox logging - zero cost, zero lock-in
    const logEntry = {
      type: 'audit:paperclip',
      sessionId,
      clipId,
      timestamp,
      groundCount,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    };
    
    // Log to console (can be replaced with any logging service)
    console.log('GlassBox Paperclip Accumulation:', JSON.stringify(logEntry));
    
    // Optional: Store in simple file or external service
    // For now, just acknowledge receipt
    
    return NextResponse.json({ 
      success: true, 
      accumulated: true,
      groundCount,
      sessionId 
    });
    
  } catch (error) {
    console.error('GlassBox paperclip logging error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Logging failed' 
    }, { status: 500 });
  }
}
