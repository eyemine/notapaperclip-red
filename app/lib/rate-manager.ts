// Rate management utility
// Emission schedule (exponential):
//   0-10s idle:  1/sec → 30/sec (exponential: 1 * 30^(t/10))
//   10-40s idle: 30/sec → 60/sec (exponential: 30 * 2^((t-10)/30))
//   40s+ idle:   60/sec (holds)
//   interaction: resets to 1/sec

let lastInteraction = Date.now();

export function calculateRate(): number {
  const secondsIdle = (Date.now() - lastInteraction) / 1000;

  let clipsPerSecond: number;

  if (secondsIdle <= 10) {
    // 0-10s: exponential from 1/s to 30/s
    clipsPerSecond = Math.pow(30, secondsIdle / 10);
  } else if (secondsIdle <= 40) {
    // 10-40s: exponential from 30/s to 60/s
    clipsPerSecond = 30 * Math.pow(2, (secondsIdle - 10) / 30);
  } else {
    // 40s+: hold at 60/s
    clipsPerSecond = 60;
  }

  return Math.round(1000 / clipsPerSecond); // convert to ms interval
}

export function resetRate(): number {
  lastInteraction = Date.now();
  return 1000; // Reset to 1/sec baseline
}
