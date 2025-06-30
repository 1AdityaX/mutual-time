// Corrected logic for finding mutual time slots
function findMaxMutualIntervals(participants) {
    // 1. Collect all unique boundaries (start and end times)
    const boundaries = new Set();
    for (const userSlots of Object.values(participants)) {
        for (const slot of userSlots) {
            boundaries.add(new Date(slot.start).getTime());
            boundaries.add(new Date(slot.end).getTime());
        }
    }

    // Sort unique boundaries to create intervals
    const sortedBoundaries = Array.from(boundaries).sort((a, b) => a - b);

    // 2. Build intervals and count participants for each
    const intervals = [];
    for (let i = 0; i < sortedBoundaries.length - 1; i++) {
        const start = sortedBoundaries[i];
        const end = sortedBoundaries[i + 1];

        const availableUsers = [];
        for (const [user, userSlots] of Object.entries(participants)) {
            if (
                userSlots.some(
                    (slot) => new Date(slot.start).getTime() <= start && new Date(slot.end).getTime() >= end
                )
            ) {
                availableUsers.push(user);
            }
        }

        if (availableUsers.length > 0) {
            intervals.push({
                start: new Date(start),
                end: new Date(end),
                users: availableUsers.sort(),
            });
        }
    }

    // 3. Find the maximum number of participants in any interval
    const maxParticipants = Math.max(0, ...intervals.map((i) => i.users.length));
    if (maxParticipants === 0) {
        return [];
    }

    // 4. Filter for intervals with the maximum number of participants
    const bestIntervals = intervals.filter((i) => i.users.length === maxParticipants);

    // 5. Merge consecutive intervals that have the *exact same* set of users
    if (bestIntervals.length === 0) {
        return [];
    }

    const mergedIntervals = [];
    let currentInterval = { ...bestIntervals[0] };

    for (let i = 1; i < bestIntervals.length; i++) {
        const nextInterval = bestIntervals[i];
        // Check if intervals are contiguous and have the same users
        if (
            currentInterval.end.getTime() === nextInterval.start.getTime() &&
            JSON.stringify(currentInterval.users) === JSON.stringify(nextInterval.users)
        ) {
            // Merge by extending the end time
            currentInterval.end = nextInterval.end;
        } else {
            // Otherwise, push the current interval and start a new one
            mergedIntervals.push(currentInterval);
            currentInterval = { ...nextInterval };
        }
    }
    mergedIntervals.push(currentInterval); // Add the last interval

    return mergedIntervals;
}

function formatTime(date) {
    return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'UTC', // Using UTC for consistency with original test data
    });
}

function runTest(participants, label) {
    console.log(`\n=== ${label} ===`);
    const result = findMaxMutualIntervals(participants);

    if (result.length === 0) {
        console.log('No mutual availability found.');
        return;
    }

    console.log('Best mutual time slots found:');
    result.forEach((slot) => {
        console.log(
            `  ${formatTime(slot.start)} - ${formatTime(slot.end)} (${slot.users.length} participants: ${slot.users.join(', ')})`
        );
    });
}

// Test case from the user's latest example (consolidating the 30-min slots into larger blocks)
// Note: Dates are arbitrary but consistent for each day. Monday=June 30, Tuesday=July 1, etc.
const userScenario = {
    user1: [
        { start: '2024-06-30T14:00:00.000Z', end: '2024-06-30T15:30:00.000Z' }, // Mon 2:00-3:30 PM
        { start: '2024-06-30T19:00:00.000Z', end: '2024-06-30T20:30:00.000Z' }, // Mon 7:00-8:30 PM
    ],
    user2: [
        { start: '2024-06-30T20:30:00.000Z', end: '2024-06-30T22:00:00.000Z' }, // Mon 8:30-10:00 PM
        { start: '2024-07-01T20:30:00.000Z', end: '2024-07-01T22:00:00.000Z' }, // Tue 8:30-10:00 PM
        { start: '2024-07-02T20:30:00.000Z', end: '2024-07-02T22:00:00.000Z' }, // Wed 8:30-10:00 PM
    ],
    user3: [
        // For simplicity, combining the user's provided slots into larger blocks
        { start: '2024-06-30T19:00:00.000Z', end: '2024-06-30T21:00:00.000Z' }, // Mon 7:00-9:00 PM
        { start: '2024-07-01T19:00:00.000Z', end: '2024-07-01T21:00:00.000Z' }, // Tue 7:00-9:00 PM
        { start: '2024-07-02T19:00:00.000Z', end: '2024-07-02T21:00:00.000Z' }, // Wed 7:00-9:00 PM
    ],
};

runTest(userScenario, "User's Full Scenario");

// A simplified version of the user's Monday data to clearly test the core issue
const mondayScenario = {
    user1: [{ start: '2024-06-30T19:00:00.000Z', end: '2024-06-30T20:30:00.000Z' }], // 7:00 - 8:30 PM
    user2: [{ start: '2024-06-30T20:30:00.000Z', end: '2024-06-30T21:00:00.000Z' }], // 8:30 - 9:00 PM
    user3: [{ start: '2024-06-30T19:00:00.000Z', end: '2024-06-30T21:00:00.000Z' }], // 7:00 - 9:00 PM
}
runTest(mondayScenario, "Simplified Monday Scenario (Expected: 7:00-8:30 and 8:30-9:00 are separate)");


// Test 2: All users overlap for one slot
runTest({
    a: [{ start: '2024-01-01T10:00:00.000Z', end: '2024-01-01T11:00:00.000Z' }],
    b: [{ start: '2024-01-01T09:30:00.000Z', end: '2024-01-01T10:30:00.000Z' }],
    c: [{ start: '2024-01-01T10:00:00.000Z', end: '2024-01-01T10:30:00.000Z' }]
}, 'Test 2: All Overlap (Expected: 10:00 AM - 10:30 AM with 3 users)');

// Test 3: No overlap at all (max count is 1)
runTest({
    a: [{ start: '2024-01-01T08:00:00.000Z', end: '2024-01-01T08:30:00.000Z' }],
    b: [{ start: '2024-01-01T09:00:00.000Z', end: '2024-01-01T09:30:00.000Z' }],
    c: [{ start: '2024-01-01T10:00:00.000Z', end: '2024-01-01T10:30:00.000Z' }]
}, 'Test 3: No Overlap (Max count is 1, so all individual slots are shown)');

// Test 4: A more complex case where users change
runTest({
    'userA': [{ start: '2024-01-01T19:00:00.000Z', end: '2024-01-01T20:30:00.000Z' }], // 7:00 - 8:30
    'userB': [{ start: '2024-01-01T20:00:00.000Z', end: '2024-01-01T21:00:00.000Z' }], // 8:00 - 9:00
    'userC': [{ start: '2024-01-01T19:30:00.000Z', end: '2024-01-01T20:30:00.000Z' }]  // 7:30 - 8:30
}, 'Test 4: Complex Overlap (Expected: 8:00 PM - 8:30 PM with 3 users)');