import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { DocumentInterface } from "@langchain/core/documents";
import { Redis } from "@upstash/redis";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { getEmbeddingsCollection, getVectorStore, checkProgress } from "../src/lib/supabase";

async function generateEmbeddings() {
  try {
    console.log("=== Starting embeddings generation process ===");
    
    // Clear Redis cache
    console.log("\n1. Clearing Redis cache...");
    const redis = Redis.fromEnv();
    await redis.flushdb();
    console.log("✓ Redis cache cleared successfully");

    console.log("\n2. Initializing vector store...");
    const vectorStore = await getVectorStore();
    console.log("✓ Vector store initialized successfully");
    
    // Clear existing documents from Supabase
    console.log("\n3. Clearing existing documents from Supabase...");
    const embeddingsCollection = await getEmbeddingsCollection();
    const { error } = await embeddingsCollection.delete().neq('id', 0);
    if (error) {
      throw new Error(`Failed to clear documents: ${error.message}`);
    }
    console.log("✓ Existing documents cleared successfully");

    // Load resume data
    console.log("\n4. Loading resume data from JSON...");
    const jsonPath = "src/data/resumeDtata.json";
    console.log(`Reading from: ${jsonPath}`);
    
    const loader = new JSONLoader(
      jsonPath,
      ["/personalInfo", "/experience", "/education", "/skills", "/projects", "/interests"]
    );

    const docs = await loader.load();
    console.log(`✓ Loaded ${docs.length} documents from JSON`);

    console.log("\n5. Processing documents...");
    const processedDocs = docs.map((doc, index): DocumentInterface => {
      console.log(`Processing document ${index + 1}/${docs.length} from section: ${doc.metadata.source}`);
      return {
        pageContent: doc.pageContent,
        metadata: {
          source: "resume",
          section: doc.metadata.source
        },
      };
    });
    console.log("✓ Documents processed successfully");

    console.log("\n6. Splitting documents into chunks...");
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    
    const splitDocs = await splitter.splitDocuments(processedDocs);
    console.log(`✓ Split into ${splitDocs.length} chunks`);

    console.log("\n7. Generating and storing embeddings...");
    for (let i = 0; i < splitDocs.length; i++) {
      try {
        console.log(`\nProcessing chunk ${i + 1}/${splitDocs.length} (${Math.round((i + 1) / splitDocs.length * 100)}%)`);
        console.log(`Content preview: "${splitDocs[i].pageContent.substring(0, 50)}..."`);
        
        // 直接尝试添加文档，不使用 Promise.race
        await vectorStore.addDocuments([splitDocs[i]]);
        
        console.log(`✓ Chunk ${i + 1} processed successfully`);
        const count = await checkProgress();
        console.log(`Current documents in database: ${count}`);
        
        // 添加较短的延迟
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error(`\n❌ Error processing chunk ${i + 1}:`);
        console.error('Error details:', error);
        
        // 在错误发生时打印更多信息
        if (error instanceof Error) {
          console.error('Error name:', error.name);
          console.error('Error message:', error.message);
          console.error('Error stack:', error.stack);
        }
        
        // 直接抛出错误，中断处理
        throw error;
      }
    }
    console.log("✓ Embeddings generated and stored successfully");

    console.log("\n=== Resume embeddings generation completed successfully! ===");
  } catch (error) {
    console.error("\n❌ Error during embeddings generation:");
    console.error(error);
    process.exit(1);
  }
}

generateEmbeddings();