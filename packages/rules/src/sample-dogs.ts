
import type { Dog } from "../engines/dog.engine";

const NOW = Math.floor(Date.now() / (1000 * 60 * 60));

export const sampleSires: Dog[] = [
{
  dogId: "Novel's Great Experiment",
  regNumber: "WV000001101",
  breedCode2: "WV",
  birthEpoch: NOW - 1000,
  sex: "M",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 14,
    forequarters: 12,
    hindquarters: 15,
    gait: 16,
    coat: 11,
    size: 10,
    temperament: 13,
    show_shine: 14,
    feet: 12,
    topline: 15
  }

  
},

{
  dogId: "Novel's Make it Happen",
  regNumber: "WV000000303",
  breedCode2: "WV",
  birthEpoch: NOW - 2500,
  sex: "M",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 3,
    forequarters: 7,
    hindquarters: 5,
    gait: 6,
    coat: 1,
    size: 10,
    temperament: 3,
    show_shine: 4,
    feet: 2,
    topline: 5
  }
},

{
  dogId: "ShowCase Ribbon Winner",
  regNumber: "WV005700105",
  breedCode2: "WV",
  birthEpoch: NOW -3000,
  sex: "M",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 9,
    forequarters: 11,
    hindquarters: 11,
    gait: 9,
    coat: 11,
    size: 10,
    temperament: 11,
    show_shine: 9,
    feet: 12,
    topline: 11
  }
},

{
  dogId: "HollowHills Get 'Em",
  regNumber: "WV077000103",
  breedCode2: "WV",
  birthEpoch: NOW - 1500,
  sex: "M",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 7,
    forequarters: 7,
    hindquarters: 7,
    gait: 16,
    coat: 11,
    size: 10,
    temperament: 13,
    show_shine: 12,
    feet: 12,
    topline: 12
  }
}

];


export const sampleDams: Dog[] = [
{
  dogId: "HollowHills Better and Better",
  regNumber: "WV000002202",
  breedCode2: "WV",
  birthEpoch: NOW - 1200,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 14,
    forequarters: 12,
    hindquarters: 15,
    gait: 16,
    coat: 11,
    size: 10,
    temperament: 13,
    show_shine: 14,
    feet: 12,
    topline: 15
  }

  
},

{
  dogId: "Novel's Happy Go Lucky",
  regNumber: "WV000000404",
  breedCode2: "WV",
  birthEpoch: NOW - 1700,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 13,
    forequarters: 7,
    hindquarters: 15,
    gait: 16,
    coat: 11,
    size: 10,
    temperament: 13,
    show_shine: 14,
    feet: 12,
    topline: 15
  }
},

{
  dogId: "ShowCase Go Girl",
  regNumber: "WV006800206",
  breedCode2: "WV",
  birthEpoch: NOW - 1500,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 9,
    forequarters: 11,
    hindquarters: 11,
    gait: 9,
    coat: 11,
    size: 10,
    temperament: 11,
    show_shine: 9,
    feet: 12,
    topline: 11
  }
},

{
  dogId: "ShowCase Checkers",
  regNumber: "WV088000204",
  breedCode2: "WV",
  birthEpoch: NOW - 2500,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 1,
    forequarters: 1,
    hindquarters: 7,
    gait: 16,
    coat: 11,
    size: 10,
    temperament: 1,
    show_shine: 1,
    feet: 1,
    topline: 1
  }
},

{
  dogId: "BrightEyes Almost Perfect",
  regNumber: "WV000000404",
  breedCode2: "WV",
  birthEpoch: NOW - 1700,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 10,
    forequarters: 9,
    hindquarters: 10,
    gait: 10,
    coat: 10,
    size: 10,
    temperament: 9,
    show_shine: 9,
    feet: 10,
    topline: 10
  }
},

{
  dogId: "Jasper's One at a Time",
  regNumber: "WV000000404",
  breedCode2: "WV",
  birthEpoch: NOW - 1700,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 1,
    forequarters: 1,
    hindquarters: 1,
    gait: 1,
    coat: 1,
    size: 1,
    temperament: 1,
    show_shine: 1,
    feet: 1,
    topline: 1
  }
},

{
  dogId: "Jasper's Top End",
  regNumber: "WV000000404",
  breedCode2: "WV",
  birthEpoch: NOW - 1700,
  sex: "F",
  status: "ALIVE",
  litterId: null,
  litterOrder: null,
  sireId: null,
  damId: null,
  traits: {
    head: 19,
    forequarters: 19,
    hindquarters: 19,
    gait: 19,
    coat: 19,
    size: 19,
    temperament: 19,
    show_shine: 19,
    feet: 19,
    topline: 19
  }
},

];

export const sampleDogs: Dog[] = [...sampleSires, ...sampleDams];
