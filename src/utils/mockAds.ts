export async function showRewardedVideo({ name }: { name: string }): Promise<boolean> {
  console.log(`[Mock Ads] Showing rewarded video: ${name}`);
  return new Promise((resolve) => {
    // Simulate a brief delay for the mock ad
    setTimeout(() => {
      resolve(true); // Always return true (reward granted) in mock
    }, 500);
  });
}
