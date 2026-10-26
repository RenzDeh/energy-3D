<script setup lang="ts">
import { OrbitControls } from "@tresjs/cientos";
import { ref } from "vue";

const scale = ref(0.5);
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

	<!-- Visual Helpers -->
	<TresAxesHelper />
	<TresGridHelper />
</template>
