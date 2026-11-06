import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Path, Stop } from "react-native-svg";

export default function GlucoseGauge({ value = 74 }: { value: number }) {
  const minVal = 40;
  const maxVal = 300;
  const radius = 100;
  const strokeWidth = 12;

  // Calculate percentage of the value within the custom bounds
  const clampedValue = Math.max(minVal, Math.min(maxVal, value));
  const percentage = (clampedValue - minVal) / (maxVal - minVal);

  // Semicircle parameters
  const cX = 120;
  const cY = 120;

  // SVG Path for a perfect 180-degree semicircle (Symmetric Top Arc)
  const backgroundArc = `M ${cX - radius} ${cY} A ${radius} ${radius} 0 0 1 ${cX + radius} ${cY}`;

  // Calculate end coordinates for the filled active progress arc
  // Angle moves from the left end of the semicircle to the right.
  const angle = Math.PI + percentage * Math.PI;
  const endX = cX + radius * Math.cos(angle);
  const endY = cY + radius * Math.sin(angle);

  const progressArc =
    `M ${cX - radius} ${cY} ` + `A ${radius} ${radius} 0 0 1 ${endX} ${endY}`;

  // Closed white sector: same endpoint as the green progress arc.
  const fillSector =
    `M ${cX} ${cY} ` +
    `L ${cX - radius} ${cY} ` +
    `A ${radius} ${radius} 0 0 1 ${endX} ${endY} ` +
    `Z`;

  // Pointer points toward the arc endpoint.
  // Adjust pointerLength and pointerWidth to match the reference.
  const pointerLength = 20;
  const pointerWidth = 25;

  const centerRadius = 42; // radius of the value circle
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);

  // Point on the value circle closest to the arc endpoint
  const baseX = cX + centerRadius * dx;
  const baseY = cY + centerRadius * dy;

  // Perpendicular direction for the two base corners
  const px = -dy;
  const py = dx;

  const tipX = baseX + pointerLength * dx;
  const tipY = baseY + pointerLength * dy;

  const pointerPath = `
  M ${baseX + (pointerWidth / 2) * px} ${baseY + (pointerWidth / 2) * py}
  L ${tipX} ${tipY}
  L ${baseX - (pointerWidth / 2) * px} ${baseY - (pointerWidth / 2) * py}
  Z
`;

  return (
    <View style={styles.container} className="min-h-[500px]">
      <View style={styles.gaugeWrapper}>
        <Svg width={cX * 2} height={cY + strokeWidth}>
          <Defs>
            <LinearGradient
              id="rainbowGrad"
              x1="0%" // Start at the left
              y1="0%" // Start at the top
              x2="100%" // End at the right
              y2="100%" // End at the bottom (Creates a diagonal gradient)
            >
              <Stop offset="0%" stopColor="#1f1f20" stopOpacity="1" />
              <Stop offset="50%" stopColor="#1F2E16" stopOpacity="1" />
              <Stop offset="100%" stopColor="#202f1c" stopOpacity="1" />
            </LinearGradient>
          </Defs>
          {/* Background Dark Track */}
          <Path
            d={backgroundArc}
            fill="none"
            stroke="#1f1f20"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* <Path d={fillSector} fill="#3AB119" stroke="none" opacity={0.2} /> */}
          <Path
            d={fillSector}
            fill={"url(#rainbowGrad)"}
            stroke="none"
            opacity={0.2}
          />
          {/* Active Colored Progress Arc */}
          <Path
            d={progressArc}
            fill="none"
            stroke="#3AB119 "
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />

          {/* Pointer behind the value circle */}
          <Path d={pointerPath} fill="#3AB119" />
        </Svg>

        {/* Center Value Badge Overlay */}
        <View style={styles.centerBadge}>
          <Text style={styles.valueText}>{value}</Text>
          <Text style={styles.unitText}>mg/dL</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0F120F",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  gaugeWrapper: {
    position: "relative",
    alignItems: "center",
  },
  centerBadge: {
    position: "absolute",
    bottom: -45, // Positioned at the flat base of the semicircle
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#1f1f20",
    borderWidth: 4,
    borderColor: "#3AB119",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  valueText: {
    fontSize: 32,
    fontWeight: "700",
    color: "#FFFFFF",
    fontFamily: "Platform-Specific-Bold-Font",
  },
  unitText: {
    fontSize: 14,
    color: "#8A928A",
    marginTop: -2,
  },
});
