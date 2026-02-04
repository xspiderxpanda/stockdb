exports.success = (res, result, message = "success") => {
  return res.status(200).json({
    status_code: 200,
    status_message: "success",
    message,
    result
  });
};

exports.badRequest = (res, message = "bad request") => {
  return res.status(400).json({
    status_code: 400,
    status_message: "bad request",
    message,
    result: []
  });
};

exports.serverError = (res, message = "server error") => {
  return res.status(500).json({
    status_code: 500,
    status_message: "server error",
    message,
    result: []
  });
};