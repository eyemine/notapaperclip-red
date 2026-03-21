import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, interactionCount, paperclipRate, timestamp } = body;
    
    // GlassBox logging - zero cost, zero lock-in
    const logEntry = {
      type: 'audit:interaction',
      sessionId,
      interactionCount,
      paperclipRate,
      timestamp,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || 'unknown'
    };
    
    // Log to console (can be replaced with any logging service)
    console.log('GlassBox Audit:', JSON.stringify(logEntry));
    
    // Optional: Store in simple file or external service
    // For now, just acknowledge receipt
    
    return NextResponse.json({ 
      success: true, 
      logged: true,
      sessionId 
    });
    
  } catch (error) {
    console.error('GlassBox logging error:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Logging failed' 
    }, { status: 500 });
  }
}
