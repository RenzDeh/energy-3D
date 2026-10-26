<script setup lang="ts">
import { OrbitControls } from "@tresjs/cientos";
import { useLoop } from "@tresjs/core";
import { ref, shallowRef } from "vue";
import type { Group } from "three";

const scale = ref(0.5);
const bladeAngles = [0, 1, 2].map((i) => (i * 2 * Math.PI) / 3);

const rotorRef = shallowRef<Group>();
const rotationSpeed = 50;

const { onBeforeRender } = useLoop();
onBeforeRender(({ delta }) => {
	if (rotorRef.value) {
		rotorRef.value.rotation.x += rotationSpeed * delta;
	}
});
</script>

<template>
	<TresPerspectiveCamera :position="[20, 10, 7]" :look-at="[0, 0, 0]" />
	<OrbitControls />

	<!-- De paal -->
	<TresMesh :position="[0, 4, 0]" :scale="scale">
		<TresCylinderGeometry :args="[0.7, 1, 15, 32]" />
		<TresMeshBasicMaterial :color="'#797674'" />
	</TresMesh>

	<!-- De kop -->
	<TresMesh :position="[0, 8, 0]" :scale="scale">
		<TresBoxGeometry :args="[2.3, 1.3, 1.4]" />
		<TresMeshBasicMaterial :color="'#797674'" />
	</TresMesh>

	<!-- De minikop -->
	<TresMesh :position="[0.5, 8, 0]" :scale="scale" :rotation="[0, 0, 11]">
		<TresCapsuleGeometry :args="[0.6, 0.7, 32]" />
	</TresMesh>

	<!-- De wieken -->
	<TresGroup ref="rotorRef" :position="[0.8, 8, 0]" :scale="scale">
		<TresGroup v-for="angle in bladeAngles" :key="angle" :rotation="[angle, 0, 0]">
			<TresMesh :position="[0, 3.5, 0]" :scale="[0.6, 1, 1]">
				<TresCylinderGeometry :args="[0.1, 0.4, 7, 32]" />
				<TresMeshBasicMaterial :color="'#e8e8e8'" />
			</TresMesh>
		</TresGroup>
	</TresGroup>

	<!-- Visual Helpers -->
	<TresAxesHelper />
	<TresGridHelper />
</template>
