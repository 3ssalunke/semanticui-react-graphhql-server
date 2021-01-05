const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { UserInputError } = require("apollo-server");

const { SECRET_KEY } = require("../../config");
const {
  validateRegisterInput,
  validateLoginInput,
} = require("../../utils/validators");

const User = require("../../models/User");

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
    },
    SECRET_KEY,
    { expiresIn: "1h" }
  );
}

module.exports = {
  Mutation: {
    async register(
      _,
      { registerInput: { username, email, password, confirmPassword } }
    ) {
      //validate user input
      const { errors, valid } = validateRegisterInput(
        username,
        email,
        password,
        confirmPassword
      );
      if (!valid) {
        throw new UserInputError("Errors", {
          errors,
        });
      }
      //make sure user doesn't already exists
      const user = await User.findOne({ $or: [{ username }, { email }] });
      if (user) {
        throw new UserInputError("Username or Email already exists", {
          errors: {
            UsernameOrEmail: "Username or Email already exists",
          },
        });
      }
      //hash the password
      const hashedPassword = await bcrypt.hash(password, 12);

      //save user
      const newUser = new User({
        username,
        email,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      });

      const result = await newUser.save();

      //create token
      const token = generateToken(result);

      //return user with token
      return { ...result._doc, id: result._id, token };
    },

    async login(_, { username, password }) {
      const { errors, valid } = validateLoginInput(username, password);
      if (!valid) {
        throw new UserInputError("Errors", {
          errors,
        });
      }

      //check user exists or not
      const user = await User.findOne({ username });
      if (!user) {
        errors.general = "User not found";
        throw new UserInputError("User not found", { errors });
      }

      //match password
      const match = await bcrypt.compare(password, user.password);
      if (!match) {
        errors.general = "Wrong credentials";
        throw new UserInputError("Wrong credentials", { errors });
      }

      //generate token
      const token = generateToken(user);

      return {
        ...user._doc,
        id: user._id,
        token,
      };
    },
  },
};
