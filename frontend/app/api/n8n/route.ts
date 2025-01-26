import { NextResponse } from 'next/server';

// Set the runtime to edge for better performance
export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const response = await fetch('https://n8n-self-hosted-1-h40x.onrender.com/webhook/ed8f1e7b-24d6-492e-8670-eb08cc37ddf4/chat', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in n8n webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from webhook' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const response = await fetch('https://n8n-self-hosted-1-h40x.onrender.com/webhook/ed8f1e7b-24d6-492e-8670-eb08cc37ddf4/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);

  } catch (error) {
    console.error('Error in n8n webhook:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch from webhook' },
      { status: 500 }
    );
  }
}
