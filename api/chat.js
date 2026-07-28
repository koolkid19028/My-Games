export default async function handler(req, res) {
    // Allow only POST requests
    if (req.method !== "POST") {
        return res.status(405).json({
            error: "Only POST requests are allowed"
        });
    }

    try {
        const { message } = req.body;

        if (!message) {
            return res.status(400).json({
                error: "Missing message"
            });
        }

        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
                },
                body: JSON.stringify({
                    model: "llama-3.1-8b-instant",

                    messages: [
                        {
                            role: "system",
                            content:
                            "You are GN-Math AI. You help with math, coding, games, and general questions. Give clear and friendly answers."
                        },
                        {
                            role: "user",
                            content: message
                        }
                    ],

                    temperature: 0.7,
                    max_tokens: 1024
                })
            }
        );


        const data = await groqResponse.json();


        if (!groqResponse.ok) {
            return res.status(500).json({
                error: data.error?.message || "Groq API failed"
            });
        }


        return res.status(200).json({
            reply: data.choices[0].message.content
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({
            error: error.message
        });

    }
}
