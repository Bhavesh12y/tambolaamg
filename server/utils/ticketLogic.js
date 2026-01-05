// Generates a random integer between min and max (inclusive)
const getRandom = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const generateTicket = () => {
    // 1. Initialize 3x9 grid with zeros
    let ticket = Array(3).fill().map(() => Array(9).fill(0));
    
    // 2. Calculate column ranges (Col 0: 1-9, Col 1: 10-19, ..., Col 8: 80-90)
    // We need to ensure each row has exactly 5 numbers.
    
    // Simplified robust algorithm for generation:
    // Create pool of numbers for each column
    let cols = [];
    for (let i = 0; i < 9; i++) {
        let min = i * 10 + (i === 0 ? 1 : 0);
        let max = i * 10 + 9;
        if (i === 8) max = 90;
        
        let nums = [];
        // Generate enough candidates
        while(nums.length < 3) {
            let n = getRandom(min, max);
            if(!nums.includes(n)) nums.push(n);
        }
        nums.sort((a,b) => a - b);
        cols.push(nums);
    }

    // Structure defining how many items per column to satisfy 15 total numbers
    // This is a simplified distribution pattern to ensure validity
    // In a full production app, this pattern should be randomized
    const structure = [
        [1,1,1,1,1,0,0,0,0], // Row 1 indices to fill (needs randomization in real impl)
        [0,0,1,1,1,1,1,0,0],
        [0,0,0,0,1,1,1,1,1] 
    ];

    // For this example, we will use a logic that guarantees 5 per row logic:
    // We will place numbers into the grid ensuring columns are sorted.
    
    // Pass 1: Ensure every row has 5 numbers
    for(let r=0; r<3; r++) {
        let count = 0;
        let availableCols = [0,1,2,3,4,5,6,7,8];
        // Shuffle columns
        availableCols.sort(() => Math.random() - 0.5);
        
        // Pick 5 columns for this row
        let chosenCols = availableCols.slice(0, 5);
        chosenCols.sort((a,b)=>a-b);

        chosenCols.forEach(c => {
             // Assign a dummy placeholder to mark this spot is taken
             ticket[r][c] = 1; 
        });
    }

    // Pass 2: Fill placeholders with actual numbers from ranges
    for (let c=0; c<9; c++) {
        let indices = [];
        for(let r=0; r<3; r++) {
            if(ticket[r][c] === 1) indices.push(r);
        }
        
        // Get 'indices.length' random numbers for this column range
        let min = c === 0 ? 1 : c * 10;
        let max = c === 8 ? 90 : c * 10 + 9;
        let numbers = [];
        while(numbers.length < indices.length) {
            let num = getRandom(min, max);
            if(!numbers.includes(num)) numbers.push(num);
        }
        numbers.sort((a,b) => a - b);

        indices.forEach((r, i) => {
            ticket[r][c] = numbers[i];
        });
        
        // Reset remaining 1s to 0s (cleanup)
        for(let r=0; r<3; r++) {
            if(ticket[r][c] === 1) ticket[r][c] = 0; // Should not happen if logic is tight
        }
    }

    return ticket;
};

module.exports = { generateTicket };