// app/api/generate-menu-image/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt) {
      return NextResponse.json(
        { message: 'prompt is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('OPENAI_API_KEY is not set');
      return NextResponse.json(
        { message: 'OPENAI_API_KEY is not set' },
        { status: 500 }
      );
    }

    // 🔥 response_format 제거
    const openaiRes = await fetch(
      'https://api.openai.com/v1/images/generations',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-image-1',
          prompt: `A high-quality realistic photo of the Korean food "${prompt}". White background, 1:1 aspect ratio. No text. Only Simple Image`,
          n: 1,
          size: '1024x1024'
        }),
      }
    );

    const text = await openaiRes.text();

    if (!openaiRes.ok) {
      console.error('OpenAI image error:', text);
      return NextResponse.json(
        { message: 'Image generation failed', detail: text },
        { status: 500 }
      );
    }

    const data = JSON.parse(text);

    // ✔️ URL 우선 사용
    const url = data?.data?.[0]?.url;

    if (url) {
      return NextResponse.json({ imageUrl: url });
    }

    // ✔️ URL 없으면 base64 사용 (당신 계정 상태는 이 케이스)
    const b64 = data?.data?.[0]?.b64_json;
    if (b64) {
      const dataUrl = `data:image/png;base64,${b64}`;
      return NextResponse.json({ imageUrl: dataUrl });
    }

    console.error('No URL or base64 in OpenAI response:', data);
    return NextResponse.json(
      { message: 'No usable image returned from OpenAI' },
      { status: 500 }
    );

  } catch (e: any) {
    console.error('generate-menu-image route exception:', e);
    return NextResponse.json(
      { message: 'Internal Server Error', detail: e?.message || e },
      { status: 500 }
    );
  }
}
