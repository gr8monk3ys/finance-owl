import Foundation

// MARK: - Currency Formatting

extension Double {

    /// Formats as full currency string: "$1,234.56"
    func asCurrency(code: String = "USD") -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        return formatter.string(from: NSNumber(value: self)) ?? "$0.00"
    }

    /// Formats as signed currency string: "+$1,234.56" or "-$1,234.56"
    func asSignedCurrency(code: String = "USD") -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.maximumFractionDigits = 2
        formatter.minimumFractionDigits = 2
        formatter.positivePrefix = "+"
        formatter.positiveSuffix = ""
        return formatter.string(from: NSNumber(value: self)) ?? "$0.00"
    }

    /// Formats as compact currency: "$1.2K", "$3.4M"
    func asCompactCurrency() -> String {
        let absValue = abs(self)
        let sign = self < 0 ? "-" : ""

        switch absValue {
        case 0..<1_000:
            return "\(sign)$\(Int(absValue))"
        case 1_000..<10_000:
            let thousands = absValue / 1_000
            if thousands.truncatingRemainder(dividingBy: 1) < 0.05 {
                return "\(sign)$\(Int(thousands))K"
            }
            return "\(sign)$\(String(format: "%.1f", thousands))K"
        case 10_000..<1_000_000:
            let thousands = absValue / 1_000
            return "\(sign)$\(Int(thousands))K"
        case 1_000_000..<10_000_000:
            let millions = absValue / 1_000_000
            if millions.truncatingRemainder(dividingBy: 1) < 0.05 {
                return "\(sign)$\(Int(millions))M"
            }
            return "\(sign)$\(String(format: "%.1f", millions))M"
        case 10_000_000...:
            let millions = absValue / 1_000_000
            return "\(sign)$\(Int(millions))M"
        default:
            return "$0"
        }
    }

    /// Formats as percentage: "35.2%"
    func asPercentage(decimals: Int = 1) -> String {
        return String(format: "%.\(decimals)f%%", self)
    }

    /// Formats as compact number without currency sign: "1.2K", "3.4M"
    func asCompactNumber() -> String {
        let absValue = abs(self)
        let sign = self < 0 ? "-" : ""

        switch absValue {
        case 0..<1_000:
            return "\(sign)\(Int(absValue))"
        case 1_000..<10_000:
            let thousands = absValue / 1_000
            if thousands.truncatingRemainder(dividingBy: 1) < 0.05 {
                return "\(sign)\(Int(thousands))K"
            }
            return "\(sign)\(String(format: "%.1f", thousands))K"
        case 10_000..<1_000_000:
            return "\(sign)\(Int(absValue / 1_000))K"
        case 1_000_000...:
            let millions = absValue / 1_000_000
            if millions.truncatingRemainder(dividingBy: 1) < 0.05 {
                return "\(sign)\(Int(millions))M"
            }
            return "\(sign)\(String(format: "%.1f", millions))M"
        default:
            return "0"
        }
    }
}

// MARK: - Date Formatting

extension Date {

    /// Relative time string: "2m ago", "3h ago", "Yesterday"
    var relativeString: String {
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: self, relativeTo: Date())
    }

    /// Short date: "Feb 15"
    var shortDateString: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "MMM d"
        return formatter.string(from: self)
    }

    /// Day of week: "Mon", "Tue"
    var dayOfWeekShort: String {
        let formatter = DateFormatter()
        formatter.dateFormat = "EEE"
        return formatter.string(from: self)
    }
}
