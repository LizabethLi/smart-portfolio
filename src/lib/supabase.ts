import { createClient } from '@supabase/supabase-js';
import { OpenAIEmbeddings } from "@langchain/openai";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { HttpsProxyAgent } from 'https-proxy-agent';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error(
    "Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.",
  );
}

if (!process.env.OPENAI_API_KEY) {
  throw new Error("Please set OPENAI_API_KEY environment variable.");
}

const proxyUrl = process.env.HTTPS_PROXY || 'http://127.0.0.1:15236';
const proxyAgent = new HttpsProxyAgent(proxyUrl);

console.log("Initializing Supabase client...");
const client = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);
console.log("✓ Supabase client initialized");

export async function getVectorStore() {
  console.log("\nInitializing Vector Store:");
  
  try {
    const embeddings = new OpenAIEmbeddings({ 
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: "text-embedding-ada-002",
      configuration: {
        baseURL: "https://api.openai.com/v1",
        httpAgent: proxyAgent
      }
    });
    
    console.log("✓ OpenAI Embeddings instance created");

    const vectorStore = new SupabaseVectorStore(
      embeddings, 
      {
        client,
        tableName: 'documents',
        queryName: 'match_documents',
      }
    );
    console.log("✓ Vector Store created successfully");
    
    return vectorStore;
  } catch (error) {
    console.error("❌ Error in getVectorStore:");
    console.error(error);
    throw error;
  }
}

export async function getEmbeddingsCollection() {
  try {
    console.log("\nGetting embeddings collection reference...");
    const collection = client.from('documents');
    console.log("✓ Embeddings collection reference obtained");
    
    const { count, error } = await collection.select('*', { count: 'exact', head: true });
    if (error) {
      throw error;
    }
    console.log(`ℹ Current document count in collection: ${count}`);
    
    return collection;
  } catch (error) {
    console.error("❌ Error accessing embeddings collection:");
    console.error(error);
    throw error;
  }
}

export async function checkProgress() {
  const { count, error } = await client
    .from('documents')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error("Error checking progress:", error);
    return null;
  }
  
  return count;
}
