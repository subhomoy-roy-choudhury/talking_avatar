import React, { Suspense, useEffect, useRef, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  useGLTF,
  useTexture,
  Loader,
  Environment,
  useFBX,
  useAnimations,
  OrthographicCamera,
} from "@react-three/drei";
import { MeshStandardMaterial } from "three/src/materials/MeshStandardMaterial";

import { LinearEncoding, sRGBEncoding } from "three/src/constants";
import { LineBasicMaterial, MeshPhysicalMaterial, Vector2 } from "three";
import ReactAudioPlayer from "react-audio-player";

import createAnimation from "./converter";
import blinkData from "./blendDataBlink.json";

import * as THREE from "three";
import axios from "axios";

import "./App.css";
import styled from "styled-components";
import { TextField, IconButton, InputAdornment } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";
import MicIcon from "@mui/icons-material/Mic";
const _ = require("lodash");

const host = "http://localhost:5000";

const LocalStorageUpdateItems = (items, newItem, setItem) => {
  let updatedItem;
  if (_.isArray(items)) {
    updatedItem = [...items, newItem];
  } else {
    updatedItem = [updatedItem];
  }
  setItem(updatedItem);
  localStorage.setItem("chatItems", JSON.stringify(updatedItem));
};

function Avatar({
  avatar_url,
  speak,
  setSpeak,
  setText,
  chatItems,
  setChatItems,
  text,
  setAudioSource,
  playing,
}) {
  let gltf = useGLTF(avatar_url);
  let morphTargetDictionaryBody = null;
  let morphTargetDictionaryLowerTeeth = null;

  const [
    bodyTexture,
    eyesTexture,
    teethTexture,
    bodySpecularTexture,
    bodyRoughnessTexture,
    bodyNormalTexture,
    teethNormalTexture,
    // teethSpecularTexture,
    hairTexture,
    tshirtDiffuseTexture,
    tshirtNormalTexture,
    tshirtRoughnessTexture,
    hairAlphaTexture,
    hairNormalTexture,
    hairRoughnessTexture,
  ] = useTexture([
    "/images/body.webp",
    "/images/eyes.webp",
    "/images/teeth_diffuse.webp",
    "/images/body_specular.webp",
    "/images/body_roughness.webp",
    "/images/body_normal.webp",
    "/images/teeth_normal.webp",
    // "/images/teeth_specular.webp",
    "/images/h_color.webp",
    "/images/tshirt_diffuse.webp",
    "/images/tshirt_normal.webp",
    "/images/tshirt_roughness.webp",
    "/images/h_alpha.webp",
    "/images/h_normal.webp",
    "/images/h_roughness.webp",
  ]);

  _.each(
    [
      bodyTexture,
      eyesTexture,
      teethTexture,
      teethNormalTexture,
      bodySpecularTexture,
      bodyRoughnessTexture,
      bodyNormalTexture,
      tshirtDiffuseTexture,
      tshirtNormalTexture,
      tshirtRoughnessTexture,
      hairAlphaTexture,
      hairNormalTexture,
      hairRoughnessTexture,
    ],
    (t) => {
      t.encoding = sRGBEncoding;
      t.flipY = false;
    }
  );

  bodyNormalTexture.encoding = LinearEncoding;
  tshirtNormalTexture.encoding = LinearEncoding;
  teethNormalTexture.encoding = LinearEncoding;
  hairNormalTexture.encoding = LinearEncoding;

  gltf.scene.traverse((node) => {
    if (
      node.type === "Mesh" ||
      node.type === "LineSegments" ||
      node.type === "SkinnedMesh"
    ) {
      node.castShadow = true;
      node.receiveShadow = true;
      node.frustumCulled = false;

      if (node.name.includes("Body")) {
        node.castShadow = true;
        node.receiveShadow = true;

        node.material = new MeshPhysicalMaterial();
        node.material.map = bodyTexture;
        // node.material.shininess = 60;
        node.material.roughness = 1.7;

        // node.material.specularMap = bodySpecularTexture;
        node.material.roughnessMap = bodyRoughnessTexture;
        node.material.normalMap = bodyNormalTexture;
        node.material.normalScale = new Vector2(0.6, 0.6);

        morphTargetDictionaryBody = node.morphTargetDictionary;

        node.material.envMapIntensity = 0.8;
        // node.material.visible = false;
      }

      if (node.name.includes("Eyes")) {
        node.material = new MeshStandardMaterial();
        node.material.map = eyesTexture;
        // node.material.shininess = 100;
        node.material.roughness = 0.1;
        node.material.envMapIntensity = 0.5;
      }

      if (node.name.includes("Brows")) {
        node.material = new LineBasicMaterial({ color: 0x000000 });
        node.material.linewidth = 1;
        node.material.opacity = 0.5;
        node.material.transparent = true;
        node.visible = false;
      }

      if (node.name.includes("Teeth")) {
        node.receiveShadow = true;
        node.castShadow = true;
        node.material = new MeshStandardMaterial();
        node.material.roughness = 0.1;
        node.material.map = teethTexture;
        node.material.normalMap = teethNormalTexture;

        node.material.envMapIntensity = 0.7;
      }

      if (node.name.includes("Hair")) {
        node.material = new MeshStandardMaterial();
        node.material.map = hairTexture;
        node.material.alphaMap = hairAlphaTexture;
        node.material.normalMap = hairNormalTexture;
        node.material.roughnessMap = hairRoughnessTexture;

        node.material.transparent = true;
        node.material.depthWrite = false;
        node.material.side = 2;
        node.material.color.setHex(0x000000);

        node.material.envMapIntensity = 0.3;
      }

      if (node.name.includes("TSHIRT")) {
        node.material = new MeshStandardMaterial();

        node.material.map = tshirtDiffuseTexture;
        node.material.roughnessMap = tshirtRoughnessTexture;
        node.material.normalMap = tshirtNormalTexture;
        node.material.color.setHex(0xffffff);

        node.material.envMapIntensity = 0.5;
      }

      if (node.name.includes("TeethLower")) {
        morphTargetDictionaryLowerTeeth = node.morphTargetDictionary;
      }
    }
  });

  const [clips, setClips] = useState([]);
  const mixer = useMemo(() => new THREE.AnimationMixer(gltf.scene), []);

  useEffect(() => {
    if (speak === false) return;

    makeSpeech(text)
      .then((response) => {
        const updatedItem = { type: "bot", message: text };
        LocalStorageUpdateItems(chatItems, updatedItem, setChatItems);

        let { blendData, filename } = response.data;

        let newClips = [
          createAnimation(blendData, morphTargetDictionaryBody, "HG_Body"),
          createAnimation(
            blendData,
            morphTargetDictionaryLowerTeeth,
            "HG_TeethLower"
          ),
        ];

        filename = host + filename;

        setClips(newClips);
        setAudioSource(filename);
        setText("");
      })
      .catch((err) => {
        console.error(err);
        setSpeak(false);
      });
  }, [speak]);

  let idleFbx = useFBX("/idle.fbx");
  let { clips: idleClips } = useAnimations(idleFbx.animations);

  idleClips[0].tracks = _.filter(idleClips[0].tracks, (track) => {
    return (
      track.name.includes("Head") ||
      track.name.includes("Neck") ||
      track.name.includes("Spine2")
    );
  });

  idleClips[0].tracks = _.map(idleClips[0].tracks, (track) => {
    if (track.name.includes("Head")) {
      track.name = "head.quaternion";
    }

    if (track.name.includes("Neck")) {
      track.name = "neck.quaternion";
    }

    if (track.name.includes("Spine")) {
      track.name = "spine2.quaternion";
    }

    return track;
  });

  useEffect(() => {
    let idleClipAction = mixer.clipAction(idleClips[0]);
    idleClipAction.play();

    let blinkClip = createAnimation(
      blinkData,
      morphTargetDictionaryBody,
      "HG_Body"
    );
    let blinkAction = mixer.clipAction(blinkClip);
    blinkAction.play();
  }, []);

  // Play animation clips when available
  useEffect(() => {
    if (playing === false) return;

    _.each(clips, (clip) => {
      let clipAction = mixer.clipAction(clip);
      clipAction.setLoop(THREE.LoopOnce);
      clipAction.play();
    });
  }, [playing]);

  useFrame((state, delta) => {
    mixer.update(delta);
  });

  return (
    <group name="avatar">
      <primitive object={gltf.scene} dispose={null} />
    </group>
  );
}

function makeSpeech(text) {
  return axios.post(host + "/talk", { text });
}

const STYLES = {
  area: { position: "absolute", bottom: "10px", left: "10px", zIndex: 500 },
  textarea: {
    width: "96%",
    borderRadius: 50,
    border: "none",
    backgroundColor: "rgba(0.1,0.1,0.1,0.5)",
    height: 52,
    textIndent: 20,
    caretColor: "#03ff00",
    color: "#ffffff",
    padding: 15,
    boxSizing: "border-box",
  },
  text: {
    margin: "0px",
    width: "300px",
    padding: "5px",
    background: "none",
    color: "#ffffff",
    fontSize: "1.2em",
    border: "none",
  },
  speak: {
    padding: "10px",
    marginTop: "5px",
    display: "block",
    color: "#FFFFFF",
    background: "#222222",
    border: "None",
  },
  area2: { position: "absolute", top: "5px", right: "15px", zIndex: 500 },
  label: { color: "#777777", fontSize: "0.8em" },
};

const ChatInput = styled.div`
  display: flex;
  flex-direction: row;
  position: absolute;
  bottom: 10px;
  left: 10px;
  z-index: 500;
  width: 98%;
  align-items: center;
  gap: 10px;
`;

const ChatBox = styled.div`
  position: absolute;
  top: 20px;
  right: 10px;
  z-index: 500;
  color: green;
  background-color: rgba(0.1, 0.1, 0.1, 0.3);
  height: 70%;
  width: 32%;
  border-radius: 18px;
  padding: 10px;
  overflow: auto;
`;

const ChatText = styled.div`
  display: flex;
  flex-direction: row;
  gap: 4px;
  margin: 10px 20px 0px 11px;
`;

function App() {
  const audioPlayer = useRef();
  const [speak, setSpeak] = useState(false);
  const [text, setText] = useState(
    "My name is Arwen. I'm a virtual human who can speak whatever you type here along with realistic facial movements."
  );
  const [audioSource, setAudioSource] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [chatItems, setChatItems] = useState(
    localStorage.getItem("chatItems") !== null
      ? JSON.parse(localStorage.getItem("chatItems"))
      : []
  );
  const inputTxt = useRef(null);

  useEffect(() => {
    inputTxt.current.focus();
  });

  useEffect(() => {
    // Reload the Page to update the Canvas
    window.addEventListener('resize', () => {
      window.location.reload();
    });
  }, []);


  // End of play
  function playerEnded(e) {
    setAudioSource(null);
    setSpeak(false);
    setPlaying(false);
  }

  // Player is read
  function playerReady(e) {
    audioPlayer.current.audioEl.current.play();
    setPlaying(true);
  }

  return (
    <div className="full">
      {/* <div style={STYLES.area}>
        <textarea rows={4} type="text" style={STYLES.text} value={text} onChange={(e) => setText(e.target.value.substring(0, 200))} />
        <button onClick={() => setSpeak(true)} style={STYLES.speak}> { speak? 'Running...': 'Speak' }</button>       
      </div> */}
      <ChatBox>
        {_.isEmpty(chatItems) ? (
          <></>
        ) : (
          chatItems.map((chat, index) => (
            <ChatText key={`chat-text-${index}`}>
              <div style={{ color: "purple", whiteSpace: "nowrap" }}>
                {chat.type} :-{" "}
              </div>
              <div style={{ color: "white" }}>{chat.message}</div>
            </ChatText>
          ))
        )}
      </ChatBox>
      <ChatInput>
        <textarea
          rows={4}
          type="text"
          className="chat-input"
          value={text}
          style={STYLES.textarea}
          onChange={(e) => setText(e.target.value.substring(0, 200))}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              // Don't generate a new line
              e.preventDefault();

              const updatedItem = { type: "user", message: text };
              LocalStorageUpdateItems(chatItems, updatedItem, setChatItems);
              setSpeak(true);
            }
          }}
          ref={inputTxt}
        />
        <IconButton
          type="submit"
          color="primary"
          variant="contained"
          aria-label="add an alarm"
          size="large"
          style={{ color: "white" }}
          onClick={() => {
            const updatedItem = { type: "user", message: text };
            LocalStorageUpdateItems(chatItems, updatedItem, setChatItems);

            setSpeak(true);
          }}
        >
          {text.trim() === "" ? (
            <MicIcon fontSize="large" />
          ) : (
            <SendIcon fontSize="large" />
          )}
        </IconButton>
      </ChatInput>

      <ReactAudioPlayer
        src={audioSource}
        ref={audioPlayer}
        onEnded={playerEnded}
        onCanPlayThrough={playerReady}
      />

      {/* <Stats /> */}
      <Canvas
        dpr={2}
        onCreated={(ctx) => {
          ctx.gl.physicallyCorrectLights = true;
        }}
      >
        <OrthographicCamera makeDefault zoom={2000} position={[0.1, 1.65, 1]} />

        {/* <OrbitControls
        target={[0, 1.65, 0]}
      /> */}

        <Suspense fallback={null}>
          <Environment
            background={false}
            files="/images/photo_studio_loft_hall_1k.hdr"
          />
        </Suspense>

        {/* <Suspense fallback={null}>
          <Bg />
        </Suspense> */}

        <Suspense fallback={null}>
          <Avatar
            avatar_url="/model.glb"
            speak={speak}
            setSpeak={setSpeak}
            setText={setText}
            chatItems={chatItems}
            setChatItems={setChatItems}
            text={text}
            setAudioSource={setAudioSource}
            playing={playing}
          />
        </Suspense>
      </Canvas>
      <Loader dataInterpolation={(p) => `Loading... please wait`} />
    </div>
  );
}

function Bg() {
  const texture = useTexture("/images/bg.webp");

  return (
    <mesh position={[0, 1.5, -2]} scale={[0.8, 0.8, 0.8]}>
      <planeBufferGeometry />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

export default App;
