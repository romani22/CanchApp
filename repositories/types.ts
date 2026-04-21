/** Returned by all subscribe() methods. Call .unsubscribe() to clean up the subscription. */
export type SubscriptionHandle = {
	unsubscribe: () => void
}
