import { Text, View } from '@tarojs/components';
import { colors } from '@knowledge-map/design-tokens';
import './index.css';

export default function IndexPage() {
  return (
    <View className="page">
      <Text className="eyebrow" style={{ color: colors.leaf }}>PHASE 0</Text>
      <Text className="title">常识地图</Text>
      <Text className="summary">小程序最小工程骨架运行正常。</Text>
    </View>
  );
}

