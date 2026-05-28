// app/api/translate-menu/route.ts
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { text } = await req.json();

    if (!text) {
      return NextResponse.json(
        { message: 'text is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: 'OPENAI_API_KEY is not set' },
        { status: 500 }
      );
    }

    const openaiRes = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content:
                'You are a translator. Translate the given Korean food menu name into a short English menu name. Do not add explanations.',
            },
            {
              role: 'user',
              content: text,
            },
          ],
        }),
      }
    );

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('OpenAI translation error:', err);
      return NextResponse.json(
        { message: 'Translation API error' },
        { status: 500 }
      );
    }

    const data = await openaiRes.json();
    const translatedText =
      data.choices?.[0]?.message?.content?.trim() || '';

    return NextResponse.json({ translatedText });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { message: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
