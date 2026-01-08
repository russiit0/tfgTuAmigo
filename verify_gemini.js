
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

async function testModels() {
    const models = ["gemini-2.0-flash", "gemini-flash-latest", "gemini-2.0-flash-exp"];

    for (const modelName of models) {
        console.log(`\nTesting model: ${modelName}...`);
        try {
            const model = genAI.getGenerativeModel({ model: modelName });
            const result = await model.generateContent("Hello, just testing.");
            console.log(`✅ SUCCESS: ${modelName} works!`);
        } catch (error) {
            console.error(`❌ FAILED: ${modelName} - ${error.message}`);
        }
    }
}

testModels();
