// Test the logic with the user's example
const timeInterval = 30; // 30-minute slots

// Mock data based on user's example - using local time
const participants = {
    user1: [
        { start: '2024-01-01T09:30:00.000Z', end: '2024-01-01T10:30:00.000Z' },
        { start: '2024-01-01T20:00:00.000Z', end: '2024-01-01T22:00:00.000Z' }
    ],
    user2: [
        { start: '2024-01-01T09:00:00.000Z', end: '2024-01-01T10:00:00.000Z' },
        { start: '2024-01-01T19:00:00.000Z', end: '2024-01-01T20:00:00.000Z' }
    ],
    user3: [
        { start: '2024-01-01T15:00:00.000Z', end: '2024-01-01T16:00:00.000Z' }
    ]
};

// Calculate availability counts for each time slot
const availabilityCounts = new Map();

for (const name in participants) {
    participants[name].forEach((slot) => {
        let current = new Date(slot.start);
        const end = new Date(slot.end);
        while (current < end) {
            const iso = current.toISOString();
            availabilityCounts.set(iso, (availabilityCounts.get(iso) || 0) + 1);
            current = new Date(current.getTime() + timeInterval * 60 * 1000);
        }
    });
}

// Find the maximum number of participants available at any time
const maxParticipants = Math.max(...availabilityCounts.values(), 0);

// Find all time slots where the maximum number of participants are available
const bestTimeISOs = [...availabilityCounts.entries()]
    .filter(([, count]) => count === maxParticipants)
    .map(([iso]) => iso)
    .sort();

console.log('Availability counts:');
for (const [iso, count] of availabilityCounts.entries()) {
    const time = new Date(iso).toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC'
    });
    console.log(`${time}: ${count} participants`);
}

console.log('\nMaximum participants available:', maxParticipants);
console.log('Best time slots:', bestTimeISOs.map(iso => {
    const time = new Date(iso).toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC'
    });
    return time;
}));

// Expected: 9:30-10:00 should have 2 participants (user1 and user2)
// This should be the best time slot 

function runTest(participants, label) {
    const timeInterval = 30;
    const availabilityCounts = new Map();

    for (const name in participants) {
        participants[name].forEach((slot) => {
            let current = new Date(slot.start);
            const end = new Date(slot.end);
            while (current < end) {
                const iso = current.toISOString();
                availabilityCounts.set(iso, (availabilityCounts.get(iso) || 0) + 1);
                current = new Date(current.getTime() + timeInterval * 60 * 1000);
            }
        });
    }

    const maxParticipants = Math.max(...availabilityCounts.values(), 0);
    const bestTimeISOs = [...availabilityCounts.entries()]
        .filter(([, count]) => count === maxParticipants)
        .map(([iso]) => iso)
        .sort();

    console.log(`\n=== ${label} ===`);
    for (const [iso, count] of availabilityCounts.entries()) {
        const time = new Date(iso).toLocaleTimeString('en-US', {
            hour12: true,
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'UTC',
        });
        console.log(`${time}: ${count} participants`);
    }
    console.log('Maximum participants available:', maxParticipants);
    console.log('Best time slots:', bestTimeISOs.map(iso => new Date(iso).toLocaleTimeString('en-US', {
        hour12: true,
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
    })));
}

// Test 1: User's original example
runTest({
    user1: [
        { start: '2024-01-01T09:30:00.000Z', end: '2024-01-01T10:30:00.000Z' },
        { start: '2024-01-01T20:00:00.000Z', end: '2024-01-01T22:00:00.000Z' }
    ],
    user2: [
        { start: '2024-01-01T09:00:00.000Z', end: '2024-01-01T10:00:00.000Z' },
        { start: '2024-01-01T19:00:00.000Z', end: '2024-01-01T20:00:00.000Z' }
    ],
    user3: [
        { start: '2024-01-01T15:00:00.000Z', end: '2024-01-01T16:00:00.000Z' }
    ]
}, 'Test 1: User Example (Expected: 9:30 AM)');

// Test 2: All users overlap 10:00-10:30
runTest({
    a: [{ start: '2024-01-01T10:00:00.000Z', end: '2024-01-01T11:00:00.000Z' }],
    b: [{ start: '2024-01-01T09:30:00.000Z', end: '2024-01-01T10:30:00.000Z' }],
    c: [{ start: '2024-01-01T10:00:00.000Z', end: '2024-01-01T10:30:00.000Z' }]
}, 'Test 2: All Overlap (Expected: 10:00 AM)');

// Test 3: No overlap at all
runTest({
    a: [{ start: '2024-01-01T08:00:00.000Z', end: '2024-01-01T08:30:00.000Z' }],
    b: [{ start: '2024-01-01T09:00:00.000Z', end: '2024-01-01T09:30:00.000Z' }],
    c: [{ start: '2024-01-01T10:00:00.000Z', end: '2024-01-01T10:30:00.000Z' }]
}, 'Test 3: No Overlap (Expected: all slots have 1 participant)');

// Test 4: Two slots tie for highest overlap
runTest({
    a: [{ start: '2024-01-01T08:00:00.000Z', end: '2024-01-01T09:00:00.000Z' }],
    b: [{ start: '2024-01-01T08:30:00.000Z', end: '2024-01-01T09:30:00.000Z' }],
    c: [{ start: '2024-01-01T08:30:00.000Z', end: '2024-01-01T09:00:00.000Z' }]
}, 'Test 4: Tie (Expected: 8:30 AM, 9:00 AM)');

// Test 5: Four users, partial overlap
runTest({
    a: [{ start: '2024-01-01T07:00:00.000Z', end: '2024-01-01T08:30:00.000Z' }],
    b: [{ start: '2024-01-01T08:00:00.000Z', end: '2024-01-01T09:00:00.000Z' }],
    c: [{ start: '2024-01-01T08:00:00.000Z', end: '2024-01-01T08:30:00.000Z' }],
    d: [{ start: '2024-01-01T08:00:00.000Z', end: '2024-01-01T08:30:00.000Z' }]
}, 'Test 5: Four Users, Partial Overlap (Expected: 8:00 AM)');