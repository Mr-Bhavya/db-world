package com.db.dbworld.app.tally.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Rupee amounts as the rest of the app shows them: ₹1,50,000.00. */
final class TallyMoneyText {

    private static final Pattern AMOUNT = Pattern.compile("₹(\\d[\\d,]*(?:\\.\\d+)?)");

    private TallyMoneyText() {}

    static String inr(BigDecimal amount) {
        BigDecimal value = (amount == null ? BigDecimal.ZERO : amount).setScale(2, RoundingMode.HALF_UP);
        String plain = value.abs().toPlainString();
        int dot = plain.indexOf('.');
        return (value.signum() < 0 ? "-₹" : "₹") + group(plain.substring(0, dot)) + plain.substring(dot);
    }

    /** Re-formats every amount in a sentence; already-formatted ones come back unchanged. */
    static String formatAmounts(String text) {
        if (text == null || text.indexOf('₹') < 0) return text;
        Matcher m = AMOUNT.matcher(text);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String raw = m.group(1).replace(",", "");
            m.appendReplacement(out, Matcher.quoteReplacement(inr(new BigDecimal(raw))));
        }
        m.appendTail(out);
        return out.toString();
    }

    /** Indian grouping: the last three digits, then pairs. */
    private static String group(String digits) {
        int n = digits.length();
        if (n <= 3) return digits;
        String head = digits.substring(0, n - 3);
        StringBuilder sb = new StringBuilder();
        int lead = head.length() % 2;
        if (lead > 0) sb.append(head, 0, lead);
        for (int i = lead; i < head.length(); i += 2) {
            if (!sb.isEmpty()) sb.append(',');
            sb.append(head, i, i + 2);
        }
        return sb.append(',').append(digits, n - 3, n).toString();
    }
}
