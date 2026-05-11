import * as TravelRateService from '../services/expenseTravelRateSettings.service.js';
import log from '../utils/logger.js';

export const getTravelRateSettings = async (req, res, next) => {
  try {
    const data = await TravelRateService.getTravelRateSettingsForApi();
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('getTravelRateSettings error:', error);
    next(error);
  }
};

export const putTravelRateSettings = async (req, res, next) => {
  try {
    const data = await TravelRateService.saveTravelRateSettings(req.body, req.user);
    res.status(200).json({ success: true, data });
  } catch (error) {
    log.error('putTravelRateSettings error:', error);
    next(error);
  }
};
