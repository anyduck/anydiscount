> [!NOTE]  
> Unfortunately, the business logic and UI are scattered throughout this repository. However, the main chunk of the business logic is in [maintenance.js](src/routes/fora//maintenance/maintenance.js), while some parts are split into modules located in [src/lib/server](src/lib/server)

# Any Discount

Any Discount app automates the creation and distribution of coupons for my local grocery food chains, which are obtained through their referral program. While &#70;&#111;&#114;&#97; has disabled the referral program for now, there’s still an opportunity to switch to using &#83;&#105;&#108;&#112;&#111;

## Development

Fill out enviromental variable from [.env.example](.env.example)
```bash
cp .env.example .env
```

Install dependencies:
```bash
npm install
```

Push the database schema:
```bash
npx drizzle-kit push
```

Start the development server:
```bash
npm run dev
```

The only way to test the cron job locally for now is curl
```bash
curl -H "Authorization: Bearer ${CRON_SECRET}" localhost:5173/fora/maintenance
```