// cleanup.js - Script to remove old temporary files
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Create __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const TEMP_DIR = path.join(__dirname, 'temp');
const MAX_AGE_MINUTES = 30; // Files older than this will be deleted

/**
 * Deletes files older than MAX_AGE_MINUTES from the temp directory
 */
export async function cleanupTempFiles() {
  console.log(`🧹 Starting cleanup of temp files older than ${MAX_AGE_MINUTES} minutes...`);
  
  try {
    // Ensure temp directory exists
    if (!fs.existsSync(TEMP_DIR)) {
      console.log(`Temp directory ${TEMP_DIR} does not exist. Creating it...`);
      fs.mkdirSync(TEMP_DIR, { recursive: true });
      return;
    }
    
    // Get all files in the temp directory
    const files = fs.readdirSync(TEMP_DIR);
    console.log(`Found ${files.length} files in temp directory`);
    
    // Current time
    const now = new Date();
    let deletedCount = 0;
    
    // Check each file
    for (const file of files) {
      const filePath = path.join(TEMP_DIR, file);
      
      // Skip directories
      if (fs.statSync(filePath).isDirectory()) {
        console.log(`Skipping directory: ${file}`);
        continue;
      }
      
      // Get file stats
      const stats = fs.statSync(filePath);
      const fileAge = (now - stats.mtime) / (1000 * 60); // Age in minutes
      
      // Delete if older than MAX_AGE_MINUTES
      if (fileAge > MAX_AGE_MINUTES) {
        console.log(`Deleting ${file} (${fileAge.toFixed(2)} minutes old)`);
        fs.unlinkSync(filePath);
        deletedCount++;
      }
    }
    
    console.log(`🧹 Cleanup complete. Deleted ${deletedCount} files.`);
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

// Run cleanup immediately if this file is executed directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cleanupTempFiles();
}