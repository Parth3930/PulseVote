# QuickPoll - Real-Time Polling Application

A modern, production-ready polling application built with Astro, React, and PostgreSQL. Create polls, share them instantly, and watch results update in real-time.

## 🚀 Features

- **Instant Poll Creation**: Create polls with a question and up to 10 options
- **Real-Time Results**: Results update automatically for all viewers using Server-Sent Events
- **Shareable Links**: Each poll gets a unique URL for easy sharing
- **Anti-Abuse Protection**: Multiple mechanisms to prevent duplicate and fraudulent voting
- **Modern UI**: Clean, responsive design built with shadcn/ui components
- **Production-Ready**: Full error handling, validation, and edge case management

## 🛡️ Fairness & Anti-Abuse Mechanisms

### 1. Browser Fingerprinting
**Threat Prevented**: Users clearing cookies/LocalStorage to vote multiple times

**Implementation**: 
- Uses `@fingerprintjs/fingerprintjs` library
- Generates a unique device identifier based on browser characteristics
- Each visitor ID is stored in the database with their vote

**How It Works**:
- When a user visits a poll page, their browser fingerprint is calculated
- This fingerprint is submitted along with their vote
- The database checks if this visitor ID has already voted on this poll
- If a matching visitor ID is found, the vote is rejected

**Limitations**:
- Can be bypassed by determined attackers with technical knowledge
- Private browsing/incognito modes may generate different fingerprints
- Browser updates can change the fingerprint
- Not foolproof but significantly raises the bar for casual abuse

### 2. IP-Based Rate Limiting
**Threat Prevented**: Automated voting scripts, bulk manipulation from single sources

**Implementation**:
- Extracts IP address from various headers (x-forwarded-for, x-real-ip, cf-connecting-ip)
- Stores IP address with each vote in the database
- Composite database index on (poll_id, ip_address) for fast lookups

**How It Works**:
- When a vote is submitted, the user's IP address is extracted from the request
- The database checks if this IP has already voted on this poll
- If a matching IP is found, the vote is rejected
- IPv4 and IPv6 addresses are supported (up to 45 characters)

**Limitations**:
- Affects legitimate users on shared networks (office, cafe, public WiFi)
- VPNs and proxies can bypass IP-based restrictions
- Multiple users behind NAT will appear as a single IP
- CGNAT (Carrier-Grade NAT) can further reduce effectiveness

## 📋 Edge Cases Handled

1. **Concurrent Votes**: Database transactions prevent race conditions when multiple users vote simultaneously
2. **Network Failures**: SSE connection includes error handling and automatic reconnection
3. **Invalid Poll IDs**: Proper 404 handling with user-friendly error messages
4. **XSS Prevention**: All user inputs are sanitized before rendering
5. **SQL Injection**: Parameterized queries via Drizzle ORM prevent injection attacks
6. **Empty Polls**: Validation prevents creating polls without at least 2 valid options
7. **Duplicate Options**: Server-side validation prevents duplicate option text
8. **Character Limits**: 
   - Question: max 500 characters
   - Options: max 200 characters each
   - Max 10 options per poll
9. **Missing Data**: Comprehensive validation on all API endpoints
10. **Browser Compatibility**: Graceful degradation for older browsers

## 🚧 Known Limitations

1. **Shared Network Limitation**: IP-based restrictions affect users on shared networks
2. **No User Authentication**: Cannot track per-user voting across different devices
3. **Single Choice Only**: No support for multiple-choice polls
4. **No Poll Editing**: Once created, polls cannot be modified
5. **No Result Hiding**: Results are immediately visible (no "hide until voting" option)
6. **Fingerprint Bypass**: Determined attackers can bypass browser fingerprinting
7. **No Anonymous IDs**: Cannot vote without JavaScript enabled

**Note**: The app is fully compatible with Vercel's serverless functions when properly configured with the `PUBLIC_SITE_URL` environment variable.

## 🛠️ Tech Stack

- **Framework**: [Astro](https://astro.build) - Modern web framework
- **UI Library**: [React](https://react.dev) with [shadcn/ui](https://ui.shadcn.com) components
- **Styling**: [Tailwind CSS](https://tailwindcss.com)
- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime
- **Database**: PostgreSQL with [Drizzle ORM](https://orm.drizzle.team)
- **Real-Time**: Server-Sent Events (SSE)
- **Fingerprinting**: [FingerprintJS](https://fingerprintjs.com)
- **Deployment**: [Vercel](https://vercel.com)
- **Color Scheme**: Modern 2026 palette (Verdant Green + Teal + Orange accents)

## 📦 Installation

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd astro-poll
   ```

2. **Install dependencies**:
   ```bash
   bun install
   ```

3. **Set up environment variables**:
   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add your Supabase connection string:
   ```
   DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres"
   ```

   **For Vercel deployment**, also add your production URL (this ensures share links work correctly):
   ```
   PUBLIC_SITE_URL="https://your-project.vercel.app"
   ```

   **Note**: You can leave `PUBLIC_SITE_URL` empty for local development. It's only required for Vercel deployment to generate correct shareable URLs.

4. **Set up the database**:
   
   Go to your Supabase project's **SQL Editor** and run the SQL commands from `drizzle/seed.sql`
   
   OR use the migration script:
   ```bash
   bun run scripts/migrate.ts
   ```

5. **Run the development server**:
   ```bash
   bun run dev
   ```
   
   Visit `http://localhost:4321` to see the application

## 🚀 Deployment

### Vercel Deployment

1. **Push your code to GitHub**

2. **Deploy on Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Click "Add New Project"
   - Import your GitHub repository
   - Configure environment variables:
     - `DATABASE_URL`: Your Supabase PostgreSQL connection string
     - `PUBLIC_SITE_URL`: Your Vercel deployment URL (e.g., `https://your-project.vercel.app`)
     - **Important**: Set `PUBLIC_SITE_URL` before first deployment to ensure shareable links work correctly
   - Click "Deploy"

3. **Set up database**:
   - Go to your Supabase project's SQL Editor
   - Copy and run the SQL from `drizzle/seed.sql`
   - This creates all tables and indexes

4. **Your app is live!** 🎉

## 📁 Project Structure

```
astro-poll/
├── src/
│   ├── components/
│   │   ├── ui/              # shadcn/ui components
│   │   ├── PollCreator.tsx   # Poll creation form
│   │   └── PollViewer.tsx   # Poll display and voting
│   ├── lib/
│   │   ├── db/              # Database schema and connection
│   │   ├── fingerprint.ts   # Browser fingerprinting utilities
│   │   └── utils.ts         # Utility functions
│   ├── pages/
│   │   ├── api/             # API endpoints
│   │   │   └── polls/       # Poll-related endpoints
│   │   ├── index.astro      # Home page
│   │   └── poll/[id].astro # Poll view page
│   ├── layouts/
│   │   └── Layout.astro     # Main layout
│   └── styles/
│       └── globals.css      # Global styles and CSS variables
├── drizzle/
│   └── seed.sql             # Database schema SQL
├── scripts/
│   └── migrate.ts           # Migration script
├── .env.example             # Example environment variables
├── astro.config.mjs         # Astro configuration
├── drizzle.config.ts        # Drizzle ORM configuration
├── tailwind.config.mjs      # Tailwind CSS configuration
└── package.json
```

## 🔧 API Endpoints

### `POST /api/polls`
Create a new poll

**Request Body**:
```json
{
  "question": "What's your favorite color?",
  "options": ["Red", "Blue", "Green"]
}
```

**Response** (201):
```json
{
  "pollId": "uuid",
  "shareUrl": "https://your-domain.com/poll/uuid",
  "question": "What's your favorite color?"
}
```

### `GET /api/polls/:id`
Get poll details with vote counts

**Response** (200):
```json
{
  "id": "uuid",
  "question": "What's your favorite color?",
  "totalVotes": 42,
  "options": [
    { "id": "uuid", "text": "Red", "voteCount": 15 },
    { "id": "uuid", "text": "Blue", "voteCount": 20 },
    { "id": "uuid", "text": "Green", "voteCount": 7 }
  ]
}
```

### `POST /api/polls/:id/vote`
Submit a vote

**Request Body**:
```json
{
  "optionId": "uuid",
  "visitorId": "fingerprint-hash"
}
```

**Response** (201):
```json
{
  "message": "Vote recorded successfully"
}
```

**Response** (403):
```json
{
  "error": "You have already voted on this poll"
}
```

### `GET /api/polls/:id/stream`
Server-Sent Events stream for real-time updates

**Events**:
```javascript
// Initial connection
data: {"type":"connected","pollId":"uuid"}

// Vote update
data: {"type":"update","pollId":"uuid","voteCounts":[...],"totalVotes":42}
```

## 🎨 Design System

### Color Palette
- **Primary**: Verdant Green (#10B981) - Trust, growth
- **Secondary**: Teal (#14B8A6) - Modern, digital feel
- **Accent**: Orange (#F97316) - CTAs and important actions
- **Background**: Warm white tint (#FAFAF9)
- **Text**: Dark slate (#1E293B) for high contrast

### Typography
- Base font size: 16px
- Scale: Responsive using Tailwind's defaults
- Headings: Bold, high contrast

### Components
All components use shadcn/ui design principles:
- Accessible color contrasts
- Smooth transitions
- Consistent spacing
- Mobile-first responsive design

## 🧪 Testing

1. **Poll Creation Flow**:
   - Create a poll with question and 2+ options
   - Verify shareable URL is generated
   - Test validation (empty questions, single option, etc.)

2. **Voting Flow**:
   - Open poll in multiple browser windows
   - Vote in one window
   - Verify results update in all windows
   - Attempt to vote twice (should be blocked)

3. **Anti-Abuse Testing**:
   - Try voting from same browser twice
   - Try voting from same IP (different browser)
   - Verify both mechanisms work correctly

4. **Real-Time Updates**:
   - Open poll in 3+ windows
   - Vote in each window
   - Watch results update in real-time

5. **Edge Cases**:
   - Test with invalid poll IDs
   - Test network disconnection
   - Test with very long questions/options
   - Test with special characters

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for your own purposes.

## 🙏 Acknowledgments

- Built with [Astro](https://astro.build)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Fingerprinting by [FingerprintJS](https://fingerprintjs.com)
