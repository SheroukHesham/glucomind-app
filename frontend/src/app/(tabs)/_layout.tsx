import { Drawer } from "expo-router/drawer";

export default function TabLayout() {
  return (
    <Drawer screenOptions={{ drawerItemStyle: { marginVertical: 5 } }}>
      <Drawer.Screen
        name="index"
        options={{
          drawerLabel: "Dashboard",
          title: "Dashboard",
        }}
      />
      <Drawer.Screen
        name="about"
        options={{
          drawerLabel: "About Us",
          title: "About Us",
        }}
      />
    </Drawer>
  );
}
