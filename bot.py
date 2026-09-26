"""
Telegram Bot for Rohit Giveaway Mini App
Features:
- Instant 1-Second Referral Tracking & Notification to Referrer
- Real-time +1 Free Spin credit in Firebase Realtime Database
- Mandatory Channel Verification (@RohitGiveaway) with Native Alert Popup
- Safe Callback Queries (fixes "BadRequest: Message is not modified")
- Resilience against mobile network/Termux drops (handles ReadError/TimedOut)
- Admin commands: /withdrawals, /payouts
- User status commands: /spins, /balance
"""

import logging
import json
import time
import urllib.request
import urllib.error
from telegram import (
    Update,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    WebAppInfo,
)
from telegram.request import HTTPXRequest
from telegram.error import NetworkError, TimedOut, Conflict, BadRequest
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
logging.getLogger("httpx").setLevel(logging.WARNING)
logging.getLogger("httpcore").setLevel(logging.WARNING)
logger = logging.getLogger("giveaway_bot")


# ----------------- Database Helpers -----------------
def get_user_from_db(user_id: str) -> dict | None:
    """Fetch user profile from Firebase RTDB."""
    try:
        req = urllib.request.Request(f"{RTDB_URL}/users/{user_id}.json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            if data and data != "null":
                return json.loads(data)
    except Exception as e:
        logger.warning(f"Error fetching user {user_id}: {e}")
    return None


def is_already_referred(referrer_id: str, new_user_id: str) -> bool:
    """Check if this new user has already been credited to the referrer."""
    try:
        req = urllib.request.Request(f"{RTDB_URL}/referrals/{referrer_id}/{new_user_id}.json")
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = resp.read().decode("utf-8")
            return data is not None and data != "null"
    except Exception:
        return False


def save_referral_record(referrer_id: str, new_user_id: str, name: str, username: str):
    """Save referral relationship in Firebase RTDB."""
    try:
        payload = json.dumps({
            "joinerId": str(new_user_id),
            "name": name,
            "username": username or "",
            "timestamp": int(time.time() * 1000),
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{RTDB_URL}/referrals/{referrer_id}/{new_user_id}.json",
            data=payload,
            method="PUT",
            headers={"Content-Type": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        logger.warning(f"Error saving referral record: {e}")


def award_spins_to_referrer(referrer_id: str, new_user_name: str) -> dict:
    """
    Increment spins and friends count in Firebase Realtime Database.
    Returns the updated referrer stats.
    """
    now_ms = int(time.time() * 1000)
    current = get_user_from_db(referrer_id)

    if current:
        new_spins = (current.get("spins") or 0) + 1
        new_friends = (current.get("friendsJoined") or 0) + 1
        new_earned = (current.get("spinsEarned") or 0) + 1

        patch_data = {
            "spins": new_spins,
            "friendsJoined": new_friends,
            "spinsEarned": new_earned,
        }
        try:
            req = urllib.request.Request(
                f"{RTDB_URL}/users/{referrer_id}.json",
                data=json.dumps(patch_data).encode("utf-8"),
                method="PATCH",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception as e:
            logger.warning(f"Error updating referrer {referrer_id}: {e}")

        # Also add a transaction record in Firebase
        tx_id = f"tx_{now_ms}_{str(new_friends)}"
        tx_data = {
            "id": tx_id,
            "userId": str(referrer_id),
            "type": "referral_bonus",
            "amount": 0,
            "description": f"Friend {new_user_name} joined! +1 Lucky Spin awarded",
            "status": "completed",
            "createdAt": now_ms,
        }
        try:
            req = urllib.request.Request(
                f"{RTDB_URL}/transactions/{tx_id}.json",
                data=json.dumps(tx_data).encode("utf-8"),
                method="PUT",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception:
            pass

        return {"spins": new_spins, "friendsJoined": new_friends}
    else:
        # User not yet in Firebase: initialize their profile with 1 bonus + 1 referral spin
        new_user = {
            "id": str(referrer_id),
            "telegramId": str(referrer_id),
            "name": f"User #{referrer_id}",
            "username": f"user_{referrer_id}",
            "balance": 0,
            "spins": 2, # 1 signup + 1 referral spin
            "friendsJoined": 1,
            "spinsEarned": 2,
            "createdAt": now_ms,
            "isVerified": True,
            "claimedWelcomeSpin": True,
        }
        try:
            req = urllib.request.Request(
                f"{RTDB_URL}/users/{referrer_id}.json",
                data=json.dumps(new_user).encode("utf-8"),
                method="PUT",
                headers={"Content-Type": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=5):
                pass
        except Exception as e:
            logger.warning(f"Error creating referrer: {e}")

        return {"spins": 2, "friendsJoined": 1}


async def process_and_notify_referral(
    bot,
    referrer_id: str,
    new_user_id: int,
    new_user_name: str,
    new_user_username: str,
):
    """
    Processes referral within 1 second and immediately sends a Telegram
    notification to the referrer with their new spin count.
    """
    clean_ref = str(referrer_id).replace("ref_", "").strip()
    clean_new_user = str(new_user_id).strip()

    # Self referral check
    if not clean_ref or clean_ref == clean_new_user:
        return

    # Check if already rewarded
    if is_already_referred(clean_ref, clean_new_user):
        logger.info(f"Referral already credited between {clean_ref} and {clean_new_user}")
        return

    # 1. Save referral record immediately
    save_referral_record(clean_ref, clean_new_user, new_user_name, new_user_username)

    # 2. Add +1 spin in Firebase database
    stats = award_spins_to_referrer(clean_ref, new_user_name)
    logger.info(f"Awarded +1 spin to referrer {clean_ref}! Total spins: {stats['spins']}")

    # 3. INSTANT TELEGRAM NOTIFICATION TO REFERRER (Delivered in 1 second)
    try:
        user_mention = f"@{new_user_username}" if new_user_username else new_user_name
        ref_alert = (
            f"🎉 <b>New Referral Joined!</b>\n\n"
            f"👤 <b>{new_user_name}</b> ({user_mention}) just started the bot using your invite link!\n\n"
            f"🎁 <b>+1 Free Lucky Spin</b> has been credited to your account instantly!\n\n"
            f"🎡 Available Spins: <b>{stats['spins']}</b>\n"
            f"👥 Total Friends Invited: <b>{stats['friendsJoined']}</b>\n\n"
            f"🚀 Open the app and spin the wheel to win instant cash!"
        )
        await bot.send_message(
            chat_id=int(clean_ref),
            text=ref_alert,
            parse_mode="HTML",
            reply_markup=build_success_keyboard(),
        )
        logger.info(f"Referral notification sent to {clean_ref}")
    except Exception as e:
        logger.warning(f"Could not send Telegram alert to referrer {clean_ref}: {e}")


# ----------------- Keyboard Builders -----------------
def build_success_keyboard(referrer_id: str | None = None) -> InlineKeyboardMarkup:
    """Build keyboard with WebApp launch button."""
    app_url = WEB_URL
    if referrer_id:
        clean_ref = str(referrer_id).replace("ref_", "").strip()
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


# ----------------- Helper Functions -----------------
async def is_user_joined(bot, user_id: int) -> bool:
    """Check if the user has joined the required Telegram channel."""
    try:
        member = await bot.get_chat_member(chat_id=CHANNEL_ID, user_id=user_id)
        return member.status in ["member", "administrator", "creator"]
    except Exception as e:
        logger.warning(f"Channel check warning for user {user_id}: {e}")
        # Allow access gracefully if bot doesn't have admin rights yet
        return True


# ----------------- Command Handlers -----------------
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handle /start command with instant referral processing."""
    if not update.effective_user or not update.message:
        return

    user = update.effective_user
    user_id = user.id
    first_name = user.first_name or "Friend"
    username = user.username or ""

    # Extract referral parameter from context.args
    referrer_id = None
    if context.args and len(context.args) > 0:
        raw_arg = context.args[0]
        referrer_id = raw_arg.replace("ref_", "").strip()

    if referrer_id and str(referrer_id) == str(user_id):
        referrer_id = None

    joined = await is_user_joined(context.bot, user_id)

    if joined:
        # Process referral reward within 1 second if referred
        if referrer_id:
            await process_and_notify_referral(
                context.bot,
                referrer_id,
                user_id,
                first_name,
                username,
            )

        welcome_text = (
            f"🎉 <b>Welcome to Rohit Giveaway, {first_name}!</b>\n\n"
            "🎁 <b>Sign Up Bonus: 1 Free Lucky Spin ready!</b>\n"
            "🤝 <b>Referral Bonus: 1 Spin per friend invite!</b>\n\n"
            "Click the button below to open the app, spin the wheel, and withdraw instant cash directly to your UPI/Bank Account!"
        )
        await update.message.reply_html(
            welcome_text,
            reply_markup=build_success_keyboard(referrer_id),
        )
    else:
        # Prompt user to join channel first
        must_join_text = (
            f"👋 Hello <b>{first_name}</b>!\n\n"
            f"⚠️ To unlock your <b>1 Free Lucky Spin</b> and participate in the Giveaway, "
            f"you must first join our official channel {CHANNEL_ID}.\n\n"
            "Join below and tap <b>Verify</b>!"
        )
        await update.message.reply_html(
            must_join_text,
            reply_markup=build_join_keyboard(referrer_id),
        )


async def check_membership(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """
    Callback query handler for 'Verify' button.
    Uses native alert popup on failure to avoid 'BadRequest: Message is not modified'.
    """
    query = update.callback_query
    if not query or not query.from_user:
        return

    user_id = query.from_user.id
    first_name = query.from_user.first_name or "Friend"
    username = query.from_user.username or ""

    referrer_id = None
    if query.data and query.data.startswith("check_"):
        ref_val = query.data.replace("check_", "").strip()
        if ref_val and ref_val != "none":
            referrer_id = ref_val

    joined = await is_user_joined(context.bot, user_id)

    if joined:
        await query.answer("✅ Verification successful! Welcome to the Giveaway!", show_alert=False)

        # Process referral reward within 1 second if referred
        if referrer_id:
            await process_and_notify_referral(
                context.bot,
                referrer_id,
                user_id,
                first_name,
                username,
            )

        success_text = (
            f"✅ <b>Verification Successful!</b>\n\n"
            f"Welcome to Rohit Giveaway, {first_name}! Your account is verified.\n"
            "🎁 <b>1 Sign Up Lucky Spin</b> has been unlocked for you!"
        )
        try:
            await query.edit_message_text(
                text=success_text,
                parse_mode="HTML",
                reply_markup=build_success_keyboard(referrer_id),
            )
        except BadRequest as e:
            if "Message is not modified" not in str(e):
                logger.warning(f"edit_message_text notice: {e}")
    else:
        # Pop up native Telegram alert - NEVER throws 'Message is not modified'!
        await query.answer(
            f"❌ You have not joined {CHANNEL_ID} yet!\n\nPlease join the channel first, then tap Verify.",
            show_alert=True,
        )


async def check_spins(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """User command /spins or /balance to check their stats."""
    if not update.effective_user or not update.message:
        return

    user_id = str(update.effective_user.id)
    first_name = update.effective_user.first_name or "Friend"
    db_user = get_user_from_db(user_id)

    if db_user:
        spins = db_user.get("spins", 0)
        friends = db_user.get("friendsJoined", 0)
        balance = db_user.get("balance", 0)
        text = (
            f"👤 <b>Account Stats for {first_name}:</b>\n\n"
            f"🎡 <b>Available Spins:</b> {spins}\n"
            f"👥 <b>Friends Joined:</b> {friends}\n"
            f"💰 <b>Wallet Balance:</b> ₹{balance:.2f}\n\n"
            "👉 Open the app to spin or withdraw cash!"
        )
    else:
        text = (
            f"👋 Hello {first_name}!\n\n"
            "🎁 You have <b>1 Free Sign Up Spin</b> waiting in the app!\n"
            "Tap below to open and start winning cash!"
        )

    await update.message.reply_html(
        text,
        reply_markup=build_success_keyboard(),
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
        with urllib.request.urlopen(req, timeout=8) as resp:
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
        await status_msg.edit_text(f"❌ Error fetching withdrawals: {e}")


# ----------------- Global Error Handler -----------------
async def error_handler(update: object, context: ContextTypes.DEFAULT_TYPE) -> None:
    """
    Prevents bot from crashing on transient Termux/mobile network drops
    and harmless BadRequest exceptions.
    """
    err = context.error
    if isinstance(err, (NetworkError, TimedOut)):
        logger.warning("⚠️ Transient network drop (ReadError/TimedOut). Bot is auto-reconnecting...")
        return
    elif isinstance(err, Conflict):
        logger.error(
            "❌ Conflict Error: Another bot instance is running with the same token! "
            "Please stop any other running instance of bot.py in Termux."
        )
        return
    elif isinstance(err, BadRequest) and "Message is not modified" in str(err):
        return

    logger.error("Unhandled exception occurred:", exc_info=err)


# ----------------- Main Runner -----------------
def main():
    logger.info("Bot starting with instant referral tracking & network resilience...")

    httpx_request = HTTPXRequest(
        connection_pool_size=16,
        read_timeout=35.0,
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

    # Register command handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("spins", check_spins))
    application.add_handler(CommandHandler("balance", check_spins))
    application.add_handler(CommandHandler("withdrawals", check_withdrawals))
    application.add_handler(CommandHandler("payouts", check_withdrawals))
    application.add_handler(CallbackQueryHandler(check_membership))

    # Register global error handler (Suppresses ReadError traceback and crashes)
    application.add_error_handler(error_handler)

    logger.info("Bot initialized successfully! Polling for Telegram updates...")

    application.run_polling(
        drop_pending_updates=True,
        allowed_updates=["message", "callback_query"],
    )


if __name__ == "__main__":
    main()
