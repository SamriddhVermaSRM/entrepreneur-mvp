import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { image }: { image: string } = await req.json();
  const response = await fetch(
    "http://localhost:8080/v1/chat/completions",
    // "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer `,
      },
      body: JSON.stringify({
        // model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "In one word describe the emotion of the person in the image.",
              },
              {
                type: "image_url",
                image_url: {
                  url: image,
                },
              },
            ],
          },
        ],
        temperature: 0.3,
        max_completion_tokens: 10,
        stop: null,
        // streaming: true,
      }),
    },
  );
  const data = await response.json();
  console.log(data);
  return NextResponse.json(data);
}
