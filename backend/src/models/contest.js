const mongoose = require('mongoose');
const { Schema } = mongoose;

const contestSchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'user',
    required: true
  },

  problems: [
    {
      problemId: {
        type: Schema.Types.ObjectId,
        ref: 'problem',
        required: true
      },
      // is problem ko user ne PEHLI baar kab solve kiya tha (comparison ke liye)
      firstSolvedAt: {
        type: Date,
        required: true
      },
      // contest ke andar ka result
      solved: {
        type: Boolean,
        default: false
      },
      solveTimeSec: {
        type: Number, // contest start se kitne second me solve hui
        default: null
      },
      attempts: {
        type: Number,
        default: 0
      },
      points: {
        type: Number,
        default: 0
      }
    }
  ],

  durationMin: {
    type: Number,
    enum: [30, 60, 90],
    required: true
  },

  startTime: {
    type: Date,
    default: Date.now
  },

  status: {
    type: String,
    enum: ['ongoing', 'finished'],
    default: 'ongoing'
  },

  totalScore: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// ek user ke ongoing contests jaldi dhundhne ke liye
contestSchema.index({ userId: 1, status: 1 });

const Contest = mongoose.model('contest', contestSchema);

module.exports = Contest;