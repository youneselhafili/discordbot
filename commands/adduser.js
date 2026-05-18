const { SlashCommandBuilder } = require('discord.js');
const { doc, getDoc, setDoc } = require('firebase/firestore');
const db = require('../database');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adduser')
        .setDescription('Register your account to use bot features'),
    async execute(interaction) {
        const userRef = doc(db, 'users', interaction.user.id);
        const checkUser = (await getDoc(userRef)).data();
        if (checkUser) {
            return interaction.reply({ content: '✅ You are already registered!', ephemeral: true });
        }
        await setDoc(userRef, {
            discord_id: interaction.user.id,
            username: interaction.user.username,
            auto_join: 'Stop'
        });
        return interaction.reply({ content: '✅ Registered! You can now use `/library` and `/autojoin`.', ephemeral: true });
    },
};
