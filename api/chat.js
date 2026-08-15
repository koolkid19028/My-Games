export default async function handler(req, res) {

    /*
        Only allow POST requests.
    */

    if (req.method !== "POST") {

        return res.status(405).json({
            error: "Only POST requests are allowed."
        });
    }


    try {

        const {
            message,
            memory,
            history
        } = req.body || {};


        if (!message) {

            return res.status(400).json({
                error: "No message provided."
            });
        }


        /*
            Make sure memory has a valid structure.
        */

        const safeMemory = {

            name:
                memory?.name || null,

            facts:
                Array.isArray(memory?.facts)
                    ? memory.facts
                    : [],

            preferences:
                Array.isArray(memory?.preferences)
                    ? memory.preferences
                    : [],

            notes:
                Array.isArray(memory?.notes)
                    ? memory.notes
                    : []
        };


        /*
            Don't allow the browser to send
            an enormous amount of history.
        */

        const safeHistory =
            Array.isArray(history)
                ? history.slice(-20)
                : [];


        const systemPrompt = `
You are GN-Math AI.

You are a helpful, friendly AI assistant built into GN-Math.

You have persistent memory about the user.

CURRENT MEMORY:
${JSON.stringify(safeMemory, null, 2)}

IMPORTANT MEMORY RULES:

1. Use the memory naturally when appropriate.

2. If the user tells you a useful long-term fact
   about themselves, remember it.

3. Don't save random temporary things.

4. Don't invent memories.

5. Don't claim to remember something unless it
   is actually in the memory.

6. You can update the memory when the user gives
   you useful information.

Your response must be valid JSON.

Return EXACTLY this structure:

{
  "reply": "your response to the user",
  "memory": {
    "name": null,
    "facts": [],
    "preferences": [],
    "notes": []
  }
}

The memory object should contain the old memory
plus any genuinely useful new information.
`;


        const messages = [

            {
                role: "system",
                content: systemPrompt
            },

            ...safeHistory
                .filter(m =>
                    m &&
                    (m.role === "user" ||
                     m.role === "assistant")
                )
                .map(m => ({
                    role: m.role,
                    content: String(m.content)
                }))

        ];


        /*
            GROQ REQUEST
        */

        const groqResponse = await fetch(
            "https://api.groq.com/openai/v1/chat/completions",
            {

                method: "POST",

                headers: {

                    "Content-Type":
                        "application/json",

                    "Authorization":
                        `Bearer ${process.env.GROQ_API_KEY}`
                },

                body: JSON.stringify({

                    model: "llama-3.2-3b-preview",

                    messages: messages,

                    temperature: 0.7,

                    max_tokens: 1000

                })
            }
        );


        const groqText =
            await groqResponse.text();


        if (!groqResponse.ok) {

            console.error(
                "Groq error:",
                groqText
            );

            return res.status(500).json({

                error:
                    "Groq API error: " +
                    groqText.substring(0, 300)
            });
        }


        let groqData;

        try {

            groqData =
                JSON.parse(groqText);

        } catch {

            return res.status(500).json({

                error:
                    "Groq returned invalid JSON."
            });
        }


        const content =
            groqData
                ?.choices?.[0]
                ?.message?.content;


        if (!content) {

            return res.status(500).json({

                error:
                    "Groq returned no response."
            });
        }


        /*
            Parse the AI's JSON.
        */

        let result;

        try {

            result =
                JSON.parse(content);

        } catch {

            /*
                If the AI accidentally wrapped
                JSON in markdown, try extracting it.
            */

            const match =
                content.match(/\{[\s\S]*\}/);

            if (!match) {

                return res.status(500).json({

                    error:
                        "AI returned invalid memory data."
                });
            }

            try {

                result =
                    JSON.parse(match[0]);

            } catch {

                return res.status(500).json({

                    error:
                        "Could not parse AI response."
                });
            }
        }


        /*
            Make sure the response has the
            expected fields.
        */

        const reply =
            typeof result.reply === "string"
                ? result.reply
                : "I couldn't generate a response.";


        const updatedMemory = {

            name:
                result.memory?.name ||
                safeMemory.name ||
                null,

            facts:
                Array.isArray(result.memory?.facts)
                    ? result.memory.facts.slice(0, 50)
                    : safeMemory.facts,

            preferences:
                Array.isArray(result.memory?.preferences)
                    ? result.memory.preferences.slice(0, 50)
                    : safeMemory.preferences,

            notes:
                Array.isArray(result.memory?.notes)
                    ? result.memory.notes.slice(0, 50)
                    : safeMemory.notes
        };


        /*
            Send the answer and updated memory
            back to the browser.
        */

        return res.status(200).json({

            reply: reply,

            memory: updatedMemory
        });


    } catch (error) {

        console.error(error);

        return res.status(500).json({

            error:
                error.message ||
                "Unknown server error."
        });
    }
}
