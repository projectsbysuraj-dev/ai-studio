"""
Telegram Bot for Rohit Giveaway Mini App
Features:
- Handles Network Drops & ReadTimeout gracefully (Fixes Termux httpcore.ReadError)
- Referral system tracking (?start=ref_XXXX)
- Mandatory Channel Verification (@RohitGiveaway)
- WebApp launch button with instant user session & referral binding
- Admin command (/withdrawals or /status) to check pending payouts directly in Telegram
"""

import logging
import json
import urllib.request
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)
from telegram.request import HTTPXRequest
from telegram.error import NetworkError, TimedOut, Conflict
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    CallbackQueryHandler,
    ContextTypes,
)

# ----------------- Configuration -----------------
TOKEN = "8639853090:AAGSrArc6Xtm5309WpZeGih1H7evsvJstWE"
CHANNEL_ID = "@RohitGiveaway"
WEB_URL = "https://ais-pre-b2ar4aapav4tu5d5je2ljl-1076687764335.asia-southeast1.run.app"
RTDB_URL = "https://telebot-26c11-default-rtdb.firebaseio.com"

# ----------------- Logging Setup -----------------
logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
# Suppress noisy lower-level HTTP logs
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("giveaway_bot")


# ----------------- Helper Functions -----------------
async def is_user_joined(bot, user_id: int) -> bool:
    """Check if the user has joined the required Telegram channel."""
    try:
        member = await bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user_id)
        return member.status in ["member", "administrator", "creator"]
    except Exception as e:
        logger.warning(f"Channel membership check warning for user {user_id}: {e}")
        # If check fails or bot isn't admin in channel yet, allow access gracefully
        return True


def build_success_keyboard(referrer_id: str | None = None) -> InlineKeyboardMarkup:
    """Build keyboard with WebApp launch button."""
    app_url = WEB_URL
    if referrer_id:
        clean_ref = str(referrer_id).replace("ref_", "")
        sep = "&" if "?" in app_url else "?"
        app_url = f"{app_url}{sep}start=ref_{clean_ref}"

    keyboard = [
        [
            InlineKeyboardButton(
                "🚀 Open Giveaway App & Spin",
                web_app=WebAppInfo(url=app_url),
            )
        ],
        [
            InlineKeyboardButton("📢 Official Channel", url=f"https://t.me/{CHANNEL_ID.lstrip('@')}"),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


def build_join_keyboard(referrer_id: str | None = None) -> InlineKeyboardMarkup:
    """Build keyboard prompting user to join channel first."""
    callback_data = f"check_{referrer_id}" if referrer_id else "check_none"
    keyboard = [
        [
            InlineKeyboardButton("📢 Join Channel", url=f"https://t.me/{CHANNEL_ID.lstrip('@')}"),
        ],
        [
            InlineKeyboardButton("✅ I Have Joined (Verify)", callback_data=callback_data),
        ],
    ]
    return InlineKeyboardMarkup(keyboard)


# ----------------- Command Handlers -----------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command with optional referral argument."""
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    user_id = user.id
    first_name = user.first_name or "Friend"

    # Extract referral parameter from context.args
    referrer_id = None
    if context.args and len(context.args) > 0:
        raw_arg = context.args[0]
        referrer_id = raw_arg.replace("ref_", "")

    # Don't let users refer themselves
    if referrer_id and str(referrer_id) == str(user_id):
        referrer_id = None

    joined = await is_user_joined(context.bot, user_id)

    if joined:
        welcome_text = (
            f"🎉 <b>Welcome, {first_name}!</b>\n\n"
            "🎁 <b>Sign Up Bonus: 1 Free Lucky Spin!</b>\n"
            "🤝 <b>Referral Bonus: 1 Spin per friend invite!</b>\n\n"
            "Click the button below to open the app, spin the wheel, and withdraw instant cash to your UPI/Bank Account!"
        )
        await update.message.reply_html(
            welcome_text,
            reply_markup=build_success_keyboard(referrer_id),
        )
    else:
        must_join_text = (
            f"👋 Hello <b>{first_name}</b>!\n\n"
            f"⚠️ To unlock your <b>1 Free Lucky Spin</b> and participate in the Giveaway, "
            f"you must first join our official channel {CHANNEL_ID}.\n\n"
            "Join below and click <b>Verify</b>!"
        )
        await update.message.reply_html(
            must_join_text,
            reply_markup=build_join_keyboard(referrer_id),
        )


async def check_membership(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Callback query to re-verify channel membership."""
    query = update.callback_query
    if not query or not query.from_user:
        return

    await query.answer()
    user_id = query.from_user.id
    first_name = query.from_user.first_name or "Friend"

    referrer_id = None
    if query.data and query.data.startswith("check_"):
        ref_val = query.data.replace("check_", "")
        if ref_val and ref_val != "none":
            referrer_id = ref_val

    joined = await is_user_joined(context.bot, user_id)

    if joined:
        success_text = (
            f"✅ <b>Verification Successful!</b>\n\n"
            f"Welcome to Rohit Giveaway, {first_name}! Your account is now verified.\n"
            "🎁 <b>1 Sign Up Lucky Spin</b> has been prepared for you!"
        )
        await query.edit_message_text(
            text=success_text,
            parse_mode="HTML",
            reply_markup=build_success_keyboard(referrer_id),
        )
    else:
        warning_text = (
            f"❌ You have not joined {CHANNEL_ID} yet!\n\n"
            "Please join the channel first, then click Verify below to start spinning and winning real cash."
        )
        await query.edit_message_text(
            text=warning_text,
            reply_markup=build_join_keyboard(referrer_id),
        )


async def check_withdrawals(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Admin command /withdrawals to check pending requests in Telegram chat."""
    if not update.message:
        return

    status_msg = await update.message.reply_text("🔄 Checking Firebase database for withdrawals...")

    try:
        req = urllib.request.Request(
            f"{RTDB_URL}/withdrawals.json",
            headers={"User-Agent": "TelegramBot/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))

        if not data:
            await status_msg.edit_text("ℹ️ No withdrawal requests found in database.")
            return

        items = list(data.values()) if isinstance(data, dict) else data
        pending = [x for x in items if isinstance(x, dict) and x.get("status") == "pending"]

        if not pending:
            await status_msg.edit_text(f"✅ Total {len(items)} withdrawals on record. 0 Pending!")
            return

        text = f"⚡ <b>Found {len(pending)} PENDING Withdrawal(s):</b>\n\n"
        for i, w in enumerate(pending[:10], start=1):
            amt = w.get("amount", 0)
            user_name = w.get("userName", "User")
            user_id = w.get("userId", "N/A")
            method = w.get("method", "upi").upper()
            detail = w.get("upiId") if method == "UPI" else f"A/C: {w.get('accountNumber')} (IFSC: {w.get('ifsc')})"
            text += f"<b>{i}. ₹{amt}</b> by {user_name} (#{user_id})\n   Type: {method} ({detail})\n\n"

        text += f"👉 Open Admin Panel: {WEB_URL}/admin"
        await status_msg.edit_text(text, parse_mode="HTML")
    except Exception as e:
        await status_msg.edit_text(f"❌ Error fetching withdrawals from database: {e}")


# ----------------- Global Error Handler -----------------
async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Prevents bot from crashing on transient Termux/mobile network drops.
    Gracefully logs temporary ReadError / TimedOut without giant tracebacks.
    """
    err = context.error
    if isinstance(err, (NetworkError, TimedOut)):
        logger.warning(
            "⚠️ Temporary network disconnection (ReadError/TimedOut). "
            "Bot is alive and reconnecting automatically..."
        )
        return
    elif isinstance(err, Conflict):
        logger.error(
            "❌ Telegram Conflict Error: Another bot instance is running with the same token! "
            "Please stop any other running terminal session of bot.py."
        )
        return

    logger.error("Unhandled exception occurred:", exc_info=err)


# ----------------- Main Runner -----------------
def main():
    logger.info("Bot starting with high-resilience network settings...")

    # Configure robust HTTP pool and extended timeouts for mobile/Termux stability
    httpx_request = HTTPXRequest(
        connection_pool_size=16,
        read_timeout=35.0,     # Prevents premature timeout during Telegram long polling
        write_timeout=35.0,
        connect_timeout=30.0,
        pool_timeout=30.0,
    )

    application = (
        ApplicationBuilder()
        .token(TOKEN)
        .request(httpx_request)
        .build()
    )

    # Register handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("withdrawals", check_withdrawals))
    application.add_handler(CommandHandler("payouts", check_withdrawals))
    application.add_handler(CallbackQueryHandler(check_membership))

    # Register global error handler (Suppress ugly Termux ReadError tracebacks)
    application.add_error_handler(error_handler)

    logger.info("Bot initialized successfully! Listening for Telegram updates...")

    # Start long polling
    application.run_polling(
        drop_pending_updates=True,
        allowed_updates=["message", "callback_query"],
    )


if __name__ == "__main__":
    main()
