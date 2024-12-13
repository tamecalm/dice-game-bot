const fs = require('fs');
const path = require('path');

// Define your header and footer
const header = `// ==========================================================================
// Dice Game Bot Project - Script Header
// ==========================================================================
//
// Project: Dice Game Bot
// Repository: https://github.com/tamecalm/dice-game-bot
// 
// Description: 
// A robust and extensible module designed for a multiplayer dice game bot. 
// Feel free to use, modify, or contribute to the project under the terms of the repository's license.
//
// Author: Engr John! 🧑‍💻
// Year: 2024
// 
// License: Licensed under the terms of the repository's license. Unauthorized duplication, 
// Modification, or distribution of this script outside the license terms is prohibited.
// ==========================================================================\n\n`;

const footer = `\n\n// ==========================================================================
// Contact: 
// If you have questions, suggestions, or ideas for improvement, please reach out through the project's repository.
//
// Contributions are highly encouraged to help improve and expand this project. Let's 
// Make it better together. Happy coding! 💡
// ==========================================================================
`;

// Function to process all JavaScript files
function processFiles(dir) {
    fs.readdirSync(dir).forEach(file => {
        const filePath = path.join(dir, file);
        const stats = fs.statSync(filePath);

        if (stats.isDirectory()) {
            processFiles(filePath); // Recursively process subdirectories
        } else if (file.endsWith('.js')) {
            let content = fs.readFileSync(filePath, 'utf8');

            // Check if the header already exists to avoid duplication
            if (!content.startsWith('// ==========================================================================')) {
                content = header + content + footer;
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Processed: ${filePath}`);
            } else {
                console.log(`Skipped (already processed): ${filePath}`);
            }
        }
    });
}

// Target the 'src' directory
const scriptsDir = path.join(__dirname, 'src'); // Adjust the path if needed
processFiles(scriptsDir);
