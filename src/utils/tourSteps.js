// First-visit tips per screen. Targets are CSS selectors; a step whose target isn't on screen shows centred.
export const TOURS = {
    home: [
        {
            title: "Welcome to Ledger 👋",
            body: "A few quick tips for this screen. Each screen shows its own tips the first time you open it - skip any time, or replay them from Settings → Tips.",
        },
        {
            target: "section[data-balances]",
            title: "Net worth",
            body: "Everything you own minus everything you owe, with the trend over time. The 👁 hides amounts when someone's looking over your shoulder.",
        },
        {
            target: 'section[aria-labelledby="this-month-title"]',
            title: "This month",
            body: "Income, spending and the stats that matter for the current month. Tap Income or Expenses to dig in.",
        },
        {
            target: 'section[aria-labelledby="where-title"]',
            title: "Where it went",
            body: "This month's spending by bucket, and your top categories since you started.",
        },
        {
            target: 'section[aria-labelledby="coming-up-title"]',
            title: "Coming up",
            body: "Credit-card payment due dates and statement closes for the next two weeks, so nothing sneaks up on you.",
        },
        {
            target: '[data-tour="add"]',
            title: "Add an expense",
            body: "Log spending from anywhere. You can add several items for one day in one go.",
        },
    ],
    expenses: [
        {
            target: 'nav[aria-label="Expenses view"]',
            title: "Three ways to look at spending",
            body: "Month: every expense, day by day. Overview: totals for any period by bucket or category. Years: each year month by month.",
        },
        {
            target: '[data-tour="month-nav"]',
            title: "Change month",
            body: "Use ‹ › to move between months. Tap the month name to see all years.",
        },
        {
            target: '[data-tour="filters"]',
            title: "Search and filter",
            body: "Search a category or comment, or filter by bucket or category. Your filter follows you to Overview and Years.",
        },
        {
            target: '[data-tour="calendar"]',
            title: "Calendar view",
            body: "See the month as a calendar - darker days are bigger spending days, trip days are underlined.",
        },
        {
            target: 'section[id^="day-"]',
            title: "Edit what you logged",
            body: "Tap any expense to change it. The ✎ next to a day's total edits the whole day at once.",
        },
    ],
    overview: [
        {
            target: '[aria-label="Period"]',
            title: "Pick a period",
            body: "This month, this year, all time - or set exact From / To months under Filters.",
        },
        {
            target: '[aria-label="Period total"]',
            title: "Totals and averages",
            body: "What you spent in the period, the monthly average and the change vs the same period last year. Below: totals since you started.",
        },
        {
            target: 'section[aria-labelledby="ranked-title"]',
            title: "Where the money went",
            body: "Ranked by bucket or category (switch at the top right). Tap a row to see its month-by-month trend and jump to those expenses.",
        },
    ],
    years: [
        {
            target: 'section[aria-label$="expenses"]',
            title: "One card per year",
            body: "The year's total, change vs last year and average per month. Each bar is a month (the biggest in red) - tap it to open that month. ⋯ opens the year in Overview or deletes it.",
        },
    ],
    addTransaction: [
        {
            target: "#add-tx-date",
            title: "Date",
            body: "The day you spent the money. If that day already has entries, matching categories are combined.",
        },
        {
            target: '[id^="row-"][id$="-category"]',
            title: "Category",
            body: "What it was for, like Groceries or Grab. Pick an existing one or type a new one. Categories are grouped into buckets in Settings.",
        },
        {
            target: '[id^="row-"][id$="-amount"]',
            title: "Amount",
            body: "One number, or several separated by commas (150, 200.50) to keep the breakdown. 0 is fine for something free; use a minus for a refund.",
        },
        {
            target: '[id^="row-"][id$="-account"]',
            title: "Paid from",
            body: "The account the money came out of - your bank, e-wallet or credit card. That account's balance goes down (or the card's balance up) automatically. Leave it empty if you don't track that wallet.",
        },
        {
            target: '[id^="row-"][id$="-travel"]',
            title: "Travel",
            body: "Tags the expense to a trip, so it counts in that trip's total and in the Travel bucket. It's picked for you when the date falls inside a trip.",
        },
        {
            title: "Saving",
            body: "\"+ Add row\" logs several items for the same day. \"Save & add another\" keeps the form open for the next one.",
        },
    ],
    travels: [
        {
            target: '[aria-label="Breakdown by"]',
            title: "Trips at a glance",
            body: "Each trip shows its dates, total, cost per day and where the money went - by bucket or by category.",
        },
        {
            target: '[aria-label="Show travel calendar"]',
            title: "Travel calendar",
            body: "See all your trips on a year calendar.",
        },
    ],
    assets: [
        {
            target: "section#history",
            title: "Total assets",
            body: "Everything you own, the change vs last month, and how it's split by account type. Switch to History for income vs spending over time.",
        },
        {
            target: '[id^="assets-"]',
            title: "Your accounts",
            body: "Grouped by type. Tap an account to reconcile its balance, add income or update a price; the status column tells you when it's due for a check.",
        },
    ],
    liabilities: [
        {
            target: 'section[aria-label="Total owed"]',
            title: "What you owe",
            body: "The total across cards and loans, and how it changed since last month.",
        },
        {
            target: '[aria-label="Cards"]',
            title: "Your cards",
            body: "Tap a card to see how much of the limit is used, its latest statement, and to make a payment or log a statement.",
        },
    ],
};
