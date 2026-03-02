# **App Name**: ChatServe Bot

## Core Features:

- Secure Phone Authentication: Users sign up and log in using Firebase Phone Authentication (OTP), with auto-login capabilities and a unique UID generated for each user.
- WhatsApp-Style Chat UI: A responsive chat interface for mobile-first experience, featuring real-time message bubbles (user on right, bot on left), timestamps, an animated typing indicator, and smooth scrolling.
- SMM Bot Conversation Tool: An AI-powered conversational tool that guides users through selecting Instagram or YouTube services, presents available options, prompts for necessary details (like links and quantities), displays pricing, and confirms orders.
- Order Placement & Firestore Storage: Upon user confirmation, new SMM orders are securely recorded into Firebase Firestore with a 'Pending' status, reflecting the provided database structure.
- Admin Order Management Panel: A dedicated web interface allowing administrators to securely log in, view all incoming orders, manually update their statuses (e.g., 'Completed', 'Processing'), and optionally export order data.

## Style Guidelines:

- Color scheme: Dark theme, mirroring WhatsApp's aesthetic. The primary color is a vibrant communication green (RGB: #33E54E), bringing a sense of action and freshness against the dark backdrop. The background features a subtle, desaturated hint of green (RGB: #1B241D) for depth and consistency. An accent color in a slightly yellowish-green (RGB: #B4E661) is used to highlight key interactive elements and provide visual dynamism.
- All text will use 'Inter' (sans-serif), chosen for its modern, neutral, and highly readable characteristics, suitable for conveying clear conversational content and functional labels across various screen sizes.
- Icons will adopt a minimalist and clean line-art style, aligning with the WhatsApp aesthetic for platform icons, service indicators, and general navigation.
- The layout is strictly mobile-first and responsive, optimized for chat interaction with message bubbles appearing on the right for the user and left for the bot, accompanied by an omnipresent message input bar at the bottom.
- Subtle animations will be employed for smooth transitions between chat messages, a dynamic typing indicator for the bot, and engaging loading and confirmation feedback to enhance user experience.