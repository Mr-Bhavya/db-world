package com.db.dbworld.player

import android.content.Context
import androidx.core.content.edit

/**
 * Persists resume position and user preferences (zoom, rotation lock, preferred audio/sub language).
 * Key is based on fileId (or URL if no fileId).
 */
object PlayerPrefs {

    private const val PREFS_NAME    = "db_world_player"
    private const val KEY_POSITION  = "pos_"
    private const val KEY_ZOOM      = "zoom_mode"
    private const val KEY_ROT_LOCK  = "rotation_locked"
    private const val KEY_BRIGHTNESS = "brightness"
    private const val KEY_AUDIO_LANG = "audio_lang"

    fun savePosition(ctx: Context, key: String, posMs: Long) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            putLong(KEY_POSITION + key, posMs)
        }
    }

    /** Returns 0 if no saved position. */
    fun loadPosition(ctx: Context, key: String): Long =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getLong(KEY_POSITION + key, 0L)

    fun clearPosition(ctx: Context, key: String) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            remove(KEY_POSITION + key)
        }
    }

    fun saveZoomMode(ctx: Context, mode: Int) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            putInt(KEY_ZOOM, mode)
        }
    }

    fun loadZoomMode(ctx: Context): Int =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getInt(KEY_ZOOM, 0)

    fun saveRotationLock(ctx: Context, locked: Boolean) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            putBoolean(KEY_ROT_LOCK, locked)
        }
    }

    fun loadRotationLock(ctx: Context): Boolean =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getBoolean(KEY_ROT_LOCK, false)

    fun saveBrightness(ctx: Context, brightness: Float) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            putFloat(KEY_BRIGHTNESS, brightness)
        }
    }

    /** Returns -1f if not set (use system brightness). */
    fun loadBrightness(ctx: Context): Float =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).getFloat(KEY_BRIGHTNESS, -1f)

    fun saveAudioLanguage(ctx: Context, lang: String) {
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit {
            putString(KEY_AUDIO_LANG, lang)
        }
    }

    fun loadAudioLanguage(ctx: Context): String =
        ctx.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .getString(KEY_AUDIO_LANG, "hin") ?: "hin"
}
