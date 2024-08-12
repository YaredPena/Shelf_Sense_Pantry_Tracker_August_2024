// Open AI API Information:

const { OpenAI } = require('openai');

const apiKey = process.env.NEXT_PUBLIC_OPENAI_API_KEY;

const openai = new OpenAI({
  apiKey: apiKey, dangerouslyAllowBrowser: true 
});

async function getCompletion(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error('Error generating response:', error);
    return 'Error generating response.';
  }
}

module.exports = { getCompletion };





//dangerouslyAllowBrowser: true 
/*
 create .env file in root directory and store your own personal API KEY inside of the file. 

*/